import { useState } from "react";

import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type { HarborArtifact, ProjectLabel } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import { UnifiedSelect } from "../../components/unified-select";
import { repositoryDisplayName, shortDigest } from "./artifact-utils";

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fullRepositoryName(project: string, repository: string): string {
  return repository.startsWith(`${project}/`)
    ? repository
    : `${project}/${repository}`;
}

async function settledFailures(tasks: Promise<unknown>[]): Promise<number> {
  const results = await Promise.allSettled(tasks);
  return results.filter((result) => result.status === "rejected").length;
}

export function ArtifactLabelDialog({
  mode,
  project,
  repository,
  artifacts,
  labels,
  onClose,
  onCompleted,
}: {
  mode: "attach" | "remove";
  project: string;
  repository: string;
  artifacts: HarborArtifact[];
  labels: ProjectLabel[];
  onClose: () => void;
  onCompleted: (failures: number) => void;
}) {
  const { locale, t } = useLocale();
  const [labelId, setLabelId] = useState(String(labels[0]?.id ?? ""));
  const attach = mode === "attach";
  return (
    <ControlDialog
      title={attach ? "批量添加标签" : "批量移除标签"}
      subtitle={
        locale === "en-US"
          ? `${attach ? "Apply a label to" : "Remove a label from"} ${String(artifacts.length)} artifacts`
          : `${attach ? "将标签添加到" : "从指定标签中移除"} ${String(artifacts.length)} 个制品`
      }
      submitLabel={attach ? "添加标签" : "移除标签"}
      destructive={!attach}
      onClose={onClose}
      onSubmit={async () => {
        const id = Number(labelId);
        if (!Number.isInteger(id) || id <= 0) {
          throw new Error(t("请选择标签"));
        }
        const failures = await settledFailures(
          artifacts.map((artifact) => {
            const hasLabel = (artifact.labels ?? []).some(
              (label) => label.id === id,
            );
            if (attach && hasLabel) return Promise.resolve();
            if (!attach && !hasLabel) return Promise.resolve();
            return attach
              ? controlApi.mutate(
                  "artifact-labels",
                  { project, repository, reference: artifact.digest },
                  "POST",
                  { id },
                )
              : controlApi.mutate(
                  "artifact-label",
                  {
                    project,
                    repository,
                    reference: artifact.digest,
                    label: id,
                  },
                  "DELETE",
                );
          }),
        );
        onCompleted(failures);
      }}
    >
      <label className="field">
        <span>{t("标签")}</span>
        <UnifiedSelect
          name="label_id"
          ariaLabel={t("标签")}
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
    </ControlDialog>
  );
}

export function CopyArtifactDialog({
  project,
  repository,
  artifact,
  onClose,
  onCopied,
}: {
  project: string;
  repository: string;
  artifact: HarborArtifact;
  onClose: () => void;
  onCopied: (project: string, repository: string) => void;
}) {
  const { t } = useLocale();
  const source = `${fullRepositoryName(project, repository)}@${artifact.digest}`;
  return (
    <ControlDialog
      title="复制制品"
      subtitle={artifact.tags?.[0]?.name ?? shortDigest(artifact.digest)}
      submitLabel="开始复制"
      onClose={onClose}
      onSubmit={async (formData) => {
        const targetProject = formString(formData, "project").trim();
        const targetRepository = formString(formData, "repository").trim();
        await controlApi.mutate(
          "artifact-copy",
          {
            project: targetProject,
            repository: targetRepository,
            from: source,
          },
          "POST",
        );
        onCopied(targetProject, targetRepository);
      }}
    >
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("目标项目")}</span>
          <input
            name="project"
            required
            maxLength={255}
            pattern="[a-z0-9]+([._\-][a-z0-9]+)*"
            defaultValue={project}
          />
        </label>
        <label className="field">
          <span>{t("目标仓库")}</span>
          <input
            name="repository"
            required
            maxLength={255}
            pattern="[a-z0-9]+([\/._\-][a-z0-9]+)*"
            defaultValue={repositoryDisplayName(project, repository)}
          />
        </label>
        <label className="field field-span">
          <span>{t("复制源")}</span>
          <input className="mono" value={source} readOnly />
        </label>
      </div>
    </ControlDialog>
  );
}

export function DeleteArtifactsDialog({
  project,
  repository,
  artifacts,
  onClose,
  onDeleted,
}: {
  project: string;
  repository: string;
  artifacts: HarborArtifact[];
  onClose: () => void;
  onDeleted: (failures: number) => void;
}) {
  const { locale, t } = useLocale();
  const confirmation = `DELETE ${String(artifacts.length)}`;
  return (
    <ControlDialog
      title="批量删除制品"
      subtitle={
        locale === "en-US"
          ? `Permanently delete ${String(artifacts.length)} artifacts and all their tags`
          : `将永久删除 ${String(artifacts.length)} 个制品及其全部 Tag`
      }
      submitLabel="永久删除"
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (formString(formData, "confirmation").trim() !== confirmation) {
          throw new Error(
            locale === "en-US"
              ? `Enter ${confirmation} to confirm`
              : `请输入 ${confirmation} 确认`,
          );
        }
        const failures = await settledFailures(
          artifacts.map((artifact) =>
            controlApi.mutate(
              "artifact",
              { project, repository, reference: artifact.digest },
              "DELETE",
            ),
          ),
        );
        onDeleted(failures);
      }}
    >
      <div className="notice notice-danger">
        <Icon name="alert" />
        <span>
          {t("此操作无法撤销。请输入")} <code>{confirmation}</code>{" "}
          {t("确认。")}
        </span>
      </div>
      <label className="field">
        <span>{t("确认文本")}</span>
        <input name="confirmation" required autoComplete="off" />
      </label>
    </ControlDialog>
  );
}
