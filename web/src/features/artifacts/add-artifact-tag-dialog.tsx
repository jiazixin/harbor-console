import { useLocale } from "../../app/locale-context";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { shortDigest } from "./artifact-utils";

import { useControlMutation } from "../../app/use-control-mutation";
import {
  type ArtifactDialogContext,
  affectedQueries,
  formString,
} from "./artifact-detail-dialogs-support";

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
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  return (
    <ControlDialog
      title="添加 Tag"
      subtitle={shortDigest(artifact.digest)}
      submitLabel="创建 Tag"
      onClose={onClose}
      onSubmit={async (formData) => {
        const name = formString(formData, "name").trim();
        await mutate({
          operation: "artifact-tags",
          parameters: { project, repository, reference: artifact.digest },
          method: "POST",
          payload: { name },
        });
        onCreated(name);
      }}
    >
      <label className={resolveClasses("field")}>
        <span>{t("Tag 名称")}</span>
        <FormInput
          name="name"
          required
          maxLength={128}
          pattern="[A-Za-z0-9_][A-Za-z0-9_.\-]{0,127}"
          autoComplete="off"
          placeholder={t("例如 v1.4.0")}
        />
      </label>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
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
