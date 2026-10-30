import { useLocale } from "../../app/locale-context";
import type { ProjectLabel } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./project-rule-dialogs-support";

type DeleteProjectLabelDialogProps = {
  label: ProjectLabel;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteProjectLabelDialog({
  label,
  onClose,
  onDeleted,
}: DeleteProjectLabelDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const subtitle =
    locale === "en-US"
      ? `Label ${label.name} will be removed from the project.`
      : `标签 ${label.name} 将从项目中删除。`;
  return (
    <ControlDialog
      title="删除项目标签"
      subtitle={subtitle}
      submitLabel="删除标签"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "label",
          parameters: { id: label.id },
          method: "DELETE",
        });
        onDeleted();
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  notice: uiStyles0.notice,
  "notice-danger": uiStyles0.noticeDanger,
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
