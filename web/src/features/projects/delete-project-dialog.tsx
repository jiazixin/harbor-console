import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { ProjectSummary } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

import { useControlMutation } from "../../app/use-control-mutation";
import { affectedQueries, formString } from "./project-dialogs-support";

type DeleteProjectDialogProps = {
  project: ProjectSummary;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
}: DeleteProjectDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  return (
    <ControlDialog
      title="删除项目"
      subtitle={
        locale === "en-US"
          ? `Project ${project.name} and its configuration will be permanently deleted. Harbor rejects deletion while repositories remain.`
          : `项目 ${project.name} 及其配置将被永久删除。Harbor 会拒绝删除仍含仓库的项目。`
      }
      submitLabel="删除项目"
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (formString(formData, "confirmation").trim() !== project.name) {
          throw new UserInputError(t("输入内容与资源名称不一致"));
        }
        await mutate({
          operation: "project",
          parameters: { project: project.name },
          method: "DELETE",
        });
        onDeleted();
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
      <label className={resolveClasses("field")}>
        <span>{t("输入资源名称确认")}</span>
        <FormInput
          name="confirmation"
          required
          autoComplete="off"
          placeholder={project.name}
        />
      </label>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  notice: uiStyles0.notice,
  "notice-danger": uiStyles0.noticeDanger,
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
