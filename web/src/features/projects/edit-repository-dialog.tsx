import type { RepositorySummary } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { FormTextarea } from "../../components/form-textarea";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

import { useControlMutation } from "../../app/use-control-mutation";
import { affectedQueries, formString } from "./repository-dialogs-support";

type EditRepositoryDialogProps = {
  project: string;
  repository: RepositorySummary;
  onClose: () => void;
  onSaved: () => void;
};

export function EditRepositoryDialog({
  project,
  repository,
  onClose,
  onSaved,
}: EditRepositoryDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  return (
    <ControlDialog
      title="编辑仓库"
      subtitle={repository.name}
      submitLabel="保存仓库"
      onClose={onClose}
      onSubmit={async (formData) => {
        await mutate({
          operation: "repository",
          parameters: { project, repository: repository.name },
          method: "PUT",
          payload: { description: formString(formData, "description").trim() },
        });
        onSaved();
      }}
    >
      <label className={resolveClasses("field")}>
        <span>仓库描述</span>
        <FormTextarea
          name="description"
          rows={4}
          maxLength={1024}
          defaultValue={repository.description ?? ""}
          placeholder="输入仓库用途或维护信息"
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
