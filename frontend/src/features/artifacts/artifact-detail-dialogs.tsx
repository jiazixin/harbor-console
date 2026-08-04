import { useCallback, useEffect, useRef, useState } from "react";

import { controlApi } from "../../app/api-client";
import { downloadText } from "../../app/download-text";
import { formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  ArtifactAccessory,
  ArtifactTag,
  HarborArtifact,
  ProjectLabel,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import {
  LogTimezoneControl,
  StructuredLog,
  type LogTimezone,
} from "../../components/structured-log";
import { UnifiedSelect } from "../../components/unified-select";
import { artifactAccessoryTypeLabel } from "./artifact-detail-sections";
import { repositoryDisplayName, shortDigest } from "./artifact-utils";

type ArtifactDialogContext = {
  project: string;
  repository: string;
  artifact: HarborArtifact;
};

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function sanitizedFilenamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "-");
}

function confirmationError(locale: "en-US" | "zh-CN"): Error {
  return new Error(
    locale === "en-US"
      ? "The entered value does not match the resource name"
      : "输入内容与资源名称不一致",
  );
}

function DestructiveConfirmation({
  title,
  subtitle,
  submitLabel,
  confirmation,
  onClose,
  onConfirm,
}: {
  title: string;
  subtitle: string;
  submitLabel: string;
  confirmation?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { locale, t } = useLocale();
  return (
    <ControlDialog
      title={title}
      subtitle={subtitle}
      submitLabel={submitLabel}
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (
          confirmation &&
          formString(formData, "confirmation") !== confirmation
        ) {
          throw confirmationError(locale);
        }
        await onConfirm();
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
      {confirmation ? (
        <label className="field">
          <span>{t("输入资源名称确认")}</span>
          <input
            name="confirmation"
            required
            autoComplete="off"
            placeholder={confirmation}
          />
        </label>
      ) : null}
    </ControlDialog>
  );
}

export function ArtifactScanDialog({
  project,
  repository,
  artifact,
  onClose,
  onSubmitted,
}: ArtifactDialogContext & {
  onClose: () => void;
  onSubmitted: (scanType: "sbom" | "vulnerability") => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="扫描制品"
      subtitle={`${repositoryDisplayName(project, repository)} · ${shortDigest(artifact.digest)}`}
      submitLabel="提交任务"
      onClose={onClose}
      onSubmit={async (formData) => {
        const scanType =
          formString(formData, "scan_type") === "sbom"
            ? "sbom"
            : "vulnerability";
        await controlApi.mutate(
          "artifact-scan",
          { project, repository, reference: artifact.digest },
          "POST",
          { scan_type: scanType },
        );
        onSubmitted(scanType);
      }}
    >
      <div className="scan-type-options">
        <label className="check-row scan-type-option">
          <input
            name="scan_type"
            type="radio"
            value="vulnerability"
            defaultChecked
          />
          <span>
            <strong>
              <Icon name="shield" />
              {t("漏洞扫描")}
            </strong>
            <small>{t("使用项目扫描器生成漏洞报告与风险等级")}</small>
          </span>
        </label>
        <label className="check-row scan-type-option">
          <input name="scan_type" type="radio" value="sbom" />
          <span>
            <strong>
              <Icon name="database" />
              {t("生成 SBOM")}
            </strong>
            <small>{t("生成软件物料清单，完成后可在 SBOM 标签页查看")}</small>
          </span>
        </label>
      </div>
    </ControlDialog>
  );
}

export function StopArtifactScanDialog({
  project,
  repository,
  artifact,
  scanType,
  onClose,
  onStopped,
}: ArtifactDialogContext & {
  scanType: "sbom" | "vulnerability";
  onClose: () => void;
  onStopped: () => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title={scanType === "sbom" ? "停止 SBOM 生成" : "停止漏洞扫描"}
      subtitle="Harbor 将请求扫描器停止当前任务"
      submitLabel="停止任务"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "artifact-scan-stop",
          { project, repository, reference: artifact.digest },
          "POST",
          { scan_type: scanType },
        );
        onStopped();
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>{t("已经生成的部分结果可能不会保留")}</span>
      </div>
    </ControlDialog>
  );
}

export function ArtifactScanLogDialog({
  project,
  repository,
  artifact,
  reportId,
  onClose,
  onNotice,
}: ArtifactDialogContext & {
  reportId: string;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [timezone, setTimezone] = useState<LogTimezone>("local");
  const requestVersion = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  const loadLog = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setLoading(true);
    setLoadError("");
    try {
      const data = await controlApi.data<unknown>(
        "artifact-scan-log",
        {
          project,
          repository,
          reference: artifact.digest,
          report: reportId,
        },
        controller.signal,
      );
      const text =
        typeof data === "string" ? data : JSON.stringify(data ?? "", null, 2);
      if (requestVersion.current === version) setValue(text);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (requestVersion.current === version) {
        setLoadError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      if (requestVersion.current === version && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [artifact.digest, project, reportId, repository]);

  useEffect(() => {
    void loadLog();
    return () => {
      requestVersion.current += 1;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [loadLog]);

  return (
    <ControlDialog
      title="制品扫描日志"
      subtitle={`${t("报告")} ${reportId}`}
      submitLabel="关闭"
      showCancel={false}
      dialogClass="control-dialog-large"
      initialFocusSelector={null}
      onClose={onClose}
      onSubmit={() => {
        onClose();
        return Promise.resolve();
      }}
    >
      <section className="scan-log-panel">
        <div className="scan-log-toolbar">
          <span>
            {loadError
              ? t("日志载入失败")
              : loading
                ? t("正在读取 Harbor 扫描日志...")
                : locale === "en-US"
                  ? `${formatNumber(value.length, locale)} characters loaded`
                  : `已载入 ${formatNumber(value.length, locale)} 个字符`}
          </span>
          <div>
            <LogTimezoneControl value={timezone} onChange={setTimezone} />
            <button
              className="icon-button"
              type="button"
              title={t("刷新日志")}
              aria-label={t("刷新日志")}
              onClick={() => void loadLog()}
            >
              <Icon name="refresh" />
            </button>
            <button
              className="icon-button"
              type="button"
              title={t("复制日志")}
              aria-label={t("复制日志")}
              onClick={() =>
                void navigator.clipboard
                  .writeText(value)
                  .then(() => onNotice("已复制到剪贴板"))
                  .catch(() => onNotice("无法写入剪贴板", true))
              }
            >
              <Icon name="copy" />
            </button>
            <button
              className="icon-button"
              type="button"
              title={t("下载日志")}
              aria-label={t("下载日志")}
              onClick={() => {
                if (!value) {
                  onNotice("当前没有可下载的扫描日志", true);
                  return;
                }
                downloadText(
                  value,
                  `${sanitizedFilenamePart(project)}-${sanitizedFilenamePart(shortDigest(artifact.digest))}-scan.log`,
                );
                onNotice("扫描日志已下载");
              }}
            >
              <Icon name="download" />
            </button>
          </div>
        </div>
        {loadError ? (
          <div className="structured-log-empty">{loadError}</div>
        ) : (
          <StructuredLog
            value={value}
            timezone={timezone}
            emptyMessage="扫描器没有返回日志内容。"
            ariaLabel="制品扫描日志"
          />
        )}
      </section>
    </ControlDialog>
  );
}

export function AddArtifactTagDialog({
  project,
  repository,
  artifact,
  onClose,
  onCreated,
}: ArtifactDialogContext & {
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="添加 Tag"
      subtitle={shortDigest(artifact.digest)}
      submitLabel="创建 Tag"
      onClose={onClose}
      onSubmit={async (formData) => {
        const name = formString(formData, "name").trim();
        await controlApi.mutate(
          "artifact-tags",
          { project, repository, reference: artifact.digest },
          "POST",
          { name },
        );
        onCreated(name);
      }}
    >
      <label className="field">
        <span>{t("Tag 名称")}</span>
        <input
          name="name"
          required
          maxLength={128}
          pattern="[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}"
          autoComplete="off"
          placeholder={t("例如 v1.4.0")}
        />
      </label>
    </ControlDialog>
  );
}

export function DeleteArtifactTagDialog({
  project,
  repository,
  artifact,
  tag,
  onClose,
  onDeleted,
}: ArtifactDialogContext & {
  tag: ArtifactTag;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale } = useLocale();
  return (
    <DestructiveConfirmation
      title="删除 Tag"
      subtitle={
        locale === "en-US"
          ? `Tag ${tag.name} will be removed from this artifact. The artifact digest will not be deleted.`
          : `Tag ${tag.name} 将从当前制品移除，制品摘要本身不会被删除。`
      }
      submitLabel="删除 Tag"
      onClose={onClose}
      onConfirm={async () => {
        await controlApi.mutate(
          "artifact-tag",
          { project, repository, reference: artifact.digest, tag: tag.name },
          "DELETE",
        );
        onDeleted();
      }}
    />
  );
}

export function AttachArtifactLabelDialog({
  project,
  repository,
  artifact,
  labels,
  onClose,
  onAttached,
}: ArtifactDialogContext & {
  labels: ProjectLabel[];
  onClose: () => void;
  onAttached: (label: ProjectLabel) => void;
}) {
  const { locale, t } = useLocale();
  const [labelId, setLabelId] = useState(String(labels[0]?.id ?? ""));
  return (
    <ControlDialog
      title="绑定制品标签"
      subtitle={shortDigest(artifact.digest)}
      submitLabel="绑定标签"
      onClose={onClose}
      onSubmit={async () => {
        const id = Number(labelId);
        const label = labels.find((item) => item.id === id);
        if (!label) throw new Error(t("请选择标签"));
        await controlApi.mutate(
          "artifact-labels",
          { project, repository, reference: artifact.digest },
          "POST",
          { id },
        );
        onAttached(label);
      }}
    >
      <label className="field">
        <span>{t("选择标签")}</span>
        <UnifiedSelect
          name="label_id"
          ariaLabel={t("选择标签")}
          value={labelId}
          options={labels.map((label) => ({
            value: String(label.id),
            label:
              locale === "en-US"
                ? `${label.name} (${label.scope === "g" ? "Global" : "Project"})`
                : `${label.name}（${label.scope === "g" ? "全局" : "项目"}）`,
          }))}
          onChange={setLabelId}
        />
      </label>
      <div className="artifact-label-options">
        {labels.map((label) => (
          <div key={label.id}>
            <span
              className="label-swatch"
              style={{ backgroundColor: label.color ?? "#8a8a8a" }}
            />
            <span className="cell-stack">
              <strong>{label.name}</strong>
              <small>
                {label.description?.trim()
                  ? t(label.description)
                  : t(label.scope === "g" ? "全局标签" : "项目标签")}
              </small>
            </span>
          </div>
        ))}
      </div>
    </ControlDialog>
  );
}

export function RemoveArtifactLabelDialog({
  project,
  repository,
  artifact,
  label,
  onClose,
  onRemoved,
}: ArtifactDialogContext & {
  label: ProjectLabel;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const { locale } = useLocale();
  return (
    <DestructiveConfirmation
      title="移除制品标签"
      subtitle={
        locale === "en-US"
          ? `Label ${label.name} will be removed from this artifact. The label definition will not be deleted.`
          : `标签 ${label.name} 将从当前制品移除，标签定义本身不会删除。`
      }
      submitLabel="移除标签"
      onClose={onClose}
      onConfirm={async () => {
        await controlApi.mutate(
          "artifact-label",
          {
            project,
            repository,
            reference: artifact.digest,
            label: label.id,
          },
          "DELETE",
        );
        onRemoved();
      }}
    />
  );
}

export function DeleteArtifactDialog({
  project,
  repository,
  artifact,
  onClose,
  onDeleted,
}: ArtifactDialogContext & {
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale } = useLocale();
  return (
    <DestructiveConfirmation
      title="删除制品"
      subtitle={
        locale === "en-US"
          ? `Artifact ${shortDigest(artifact.digest)} and all of its tags will be permanently deleted.`
          : `制品 ${shortDigest(artifact.digest)} 及其全部 Tag 将被永久删除。`
      }
      submitLabel="删除制品"
      confirmation={artifact.digest}
      onClose={onClose}
      onConfirm={async () => {
        await controlApi.mutate(
          "artifact",
          { project, repository, reference: artifact.digest },
          "DELETE",
        );
        onDeleted();
      }}
    />
  );
}

export function DeleteAccessoryArtifactDialog({
  project,
  repository,
  accessory,
  onClose,
  onDeleted,
}: ArtifactDialogContext & {
  accessory: ArtifactAccessory;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  const accessoryLabel = t(artifactAccessoryTypeLabel(accessory.type));
  return (
    <DestructiveConfirmation
      title="删除关联制品"
      subtitle={
        locale === "en-US"
          ? `${accessoryLabel} ${shortDigest(accessory.digest)} will be permanently deleted from this repository.`
          : `${accessoryLabel} ${shortDigest(accessory.digest)} 将从当前仓库永久删除。`
      }
      submitLabel="删除关联制品"
      confirmation={accessory.digest}
      onClose={onClose}
      onConfirm={async () => {
        await controlApi.mutate(
          "artifact",
          { project, repository, reference: accessory.digest },
          "DELETE",
        );
        onDeleted();
      }}
    />
  );
}
