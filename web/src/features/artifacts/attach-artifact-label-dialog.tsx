import { useState } from "react";
import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { ProjectLabel } from "../../app/models";
import { ColorSwatch } from "../../components/color-swatch";
import { ControlDialog } from "../../components/control-dialog";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { shortDigest } from "./artifact-utils";

import { useControlMutation } from "../../app/use-control-mutation";
import {
  type ArtifactDialogContext,
  affectedQueries,
} from "./artifact-detail-dialogs-support";
import styles from "./artifacts.module.css";

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
  const mutate = useControlMutation(affectedQueries);
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
        if (!label) throw new UserInputError(t("请选择标签"));
        await mutate({
          operation: "artifact-labels",
          parameters: { project, repository, reference: artifact.digest },
          method: "POST",
          payload: { id },
        });
        onAttached(label);
      }}
    >
      <label className={resolveClasses("field")}>
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
      <div className={resolveClasses(styles.artifactLabelOptions)}>
        {labels.map((label) => (
          <div key={label.id}>
            <ColorSwatch
              className={resolveClasses("label-swatch")}
              color={label.color}
            />
            <span className={resolveClasses("cell-stack")}>
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

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  "unified-select": uiStyles0.unifiedSelect,
  field: uiStyles0.field,
  "label-swatch": uiStyles0.labelSwatch,
  "cell-stack": uiStyles0.cellStack,
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
