import { useState } from "react";
import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { HarborArtifact, ProjectLabel } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries, settledFailures } from "./artifact-dialogs-support";

type ArtifactLabelDialogProps = {
  mode: "attach" | "remove";
  project: string;
  repository: string;
  artifacts: HarborArtifact[];
  labels: ProjectLabel[];
  onClose: () => void;
  onCompleted: (failures: number) => void;
};

export function ArtifactLabelDialog({
  mode,
  project,
  repository,
  artifacts,
  labels,
  onClose,
  onCompleted,
}: ArtifactLabelDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
          throw new UserInputError(t("请选择标签"));
        }
        const failures = await settledFailures(
          artifacts.map((artifact) => {
            const hasLabel = (artifact.labels ?? []).some(
              (label) => label.id === id,
            );
            if (attach && hasLabel) return Promise.resolve();
            if (!attach && !hasLabel) return Promise.resolve();
            return attach
              ? mutate({
                  operation: "artifact-labels",
                  parameters: {
                    project,
                    repository,
                    reference: artifact.digest,
                  },
                  method: "POST",
                  payload: { id },
                })
              : mutate({
                  operation: "artifact-label",
                  parameters: {
                    project,
                    repository,
                    reference: artifact.digest,
                    label: id,
                  },
                  method: "DELETE",
                });
          }),
        );
        onCompleted(failures);
      }}
    >
      <label className={resolveClasses("field")}>
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

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  "unified-select": uiStyles0.unifiedSelect,
  field: uiStyles0.field,
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
