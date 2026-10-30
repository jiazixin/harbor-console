import { useLocale } from "../../app/locale-context";
import type { ProjectRobot } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./project-robot-dialogs-support";

type DeleteProjectRobotDialogProps = {
  project: string;
  robot: ProjectRobot;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteProjectRobotDialog({
  project,
  robot,
  onClose,
  onDeleted,
}: DeleteProjectRobotDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const subtitle =
    locale === "en-US"
      ? `Account ${robot.name} will immediately lose access to project ${project}.`
      : `账号 ${robot.name} 将立即失去项目访问权限。`;
  return (
    <ControlDialog
      title="删除机器人账号"
      subtitle={subtitle}
      submitLabel="删除账号"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "robot",
          parameters: { id: robot.id },
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
