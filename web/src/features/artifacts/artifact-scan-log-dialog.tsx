import { useState } from "react";
import { controlApi } from "../../app/api-client";
import { downloadText } from "../../app/download-text";
import { useLocale } from "../../app/locale-context";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import { LogTimezoneControl } from "../../components/log-timezone-control";
import uiStyles0 from "../../components/shared-ui.module.css";
import { StructuredLog } from "../../components/structured-log";
import { type LogTimezone } from "../../components/structured-log-support";
import { createClassNames } from "../../lib/css/class-names";
import { formatNumber } from "../../lib/format/formatters";
import { artifactKeys } from "./artifact-keys";
import { shortDigest } from "./artifact-utils";

import { type ArtifactDialogContext } from "./artifact-detail-dialogs-support";

function sanitizedFilenamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "-");
}

type ArtifactScanLogDialogProps = ArtifactDialogContext & {
  reportId: string;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function ArtifactScanLogDialog({
  project,
  repository,
  artifact,
  reportId,
  onClose,
  onNotice,
}: ArtifactScanLogDialogProps) {
  const { locale, t } = useLocale();
  const [timezone, setTimezone] = useState<LogTimezone>("local");
  const logQuery = useArtifactScanLogData({
    project,
    repository,
    artifact,
    reportId,
  });
  const value = logQuery.data ?? "";
  const loading = logQuery.loading;
  const loadError = logQuery.error;

  return (
    <ControlDialog
      title="制品扫描日志"
      subtitle={`${t("报告")} ${reportId}`}
      submitLabel="关闭"
      showCancel={false}
      dialogClass={resolveClasses("control-dialog-large")}
      initialFocusSelector={null}
      onClose={onClose}
      onSubmit={() => {
        onClose();
        return Promise.resolve();
      }}
    >
      <section className={resolveClasses("scan-log-panel")}>
        <div className={resolveClasses("scan-log-toolbar")}>
          <span>
            {(() => {
              if (loadError) {
                return t("日志载入失败");
              }
              if (loading) {
                return t("正在读取 Harbor 扫描日志...");
              }
              if (locale === "en-US") {
                return `${formatNumber(value.length, locale)} characters loaded`;
              }
              return `已载入 ${formatNumber(value.length, locale)} 个字符`;
            })()}
          </span>
          <div>
            <LogTimezoneControl value={timezone} onChange={setTimezone} />
            <button
              className={resolveClasses("icon-button")}
              type="button"
              title={t("刷新日志")}
              aria-label={t("刷新日志")}
              onClick={logQuery.reload}
            >
              <Icon name="refresh" />
            </button>
            <button
              className={resolveClasses("icon-button")}
              type="button"
              title={t("复制日志")}
              aria-label={t("复制日志")}
              onClick={() =>
                void navigator.clipboard
                  .writeText(value)
                  .then(() => {
                    onNotice("已复制到剪贴板");
                  })
                  .catch(() => {
                    onNotice("无法写入剪贴板", true);
                  })
              }
            >
              <Icon name="copy" />
            </button>
            <button
              className={resolveClasses("icon-button")}
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
          <div className={resolveClasses("structured-log-empty")}>
            {loadError}
          </div>
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

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  "log-timezone-control": uiStyles0.logTimezoneControl,
  "control-dialog-large": uiStyles0.controlDialogLarge,
  "scan-log-panel": uiStyles0.scanLogPanel,
  "scan-log-toolbar": uiStyles0.scanLogToolbar,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
  "structured-log-empty": uiStyles0.structuredLogEmpty,
  "harbor-banner-warning": uiStyles0.harborBannerWarning,
  "harbor-banner-success": uiStyles0.harborBannerSuccess,
  "harbor-banner-info": uiStyles0.harborBannerInfo,
  "harbor-banner-danger": uiStyles0.harborBannerDanger,
  clickable: uiStyles0.clickable,
  "overlay-open": uiStyles0.overlayOpen,
  "log-level-trace": uiStyles0.logLevelTrace,
  "log-level-debug": uiStyles0.logLevelDebug,
  "log-level-log": uiStyles0.logLevelLog,
  "log-level-info": uiStyles0.logLevelInfo,
  "log-level-warn": uiStyles0.logLevelWarn,
  "log-level-error": uiStyles0.logLevelError,
  "log-level-fatal": uiStyles0.logLevelFatal,
});

function useArtifactScanLogData({
  project,
  repository,
  artifact,
  reportId,
}: Pick<
  ArtifactScanLogDialogProps,
  "project" | "repository" | "artifact" | "reportId"
>) {
  return useLoadedQuery(
    artifactKeys.scanLog({
      project,
      repository,
      reference: artifact.digest,
      report: reportId,
    }),
    (signal) =>
      controlApi
        .data<unknown>(
          "artifact-scan-log",
          {
            project,
            repository,
            reference: artifact.digest,
            report: reportId,
          },
          signal,
        )
        .then((scanLog) =>
          typeof scanLog === "string"
            ? scanLog
            : JSON.stringify(scanLog ?? "", null, 2),
        ),
  );
}
