import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { ProjectRobot, RobotCredential } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./project-robot-dialogs-support";

type ResetRobotSecretDialogProps = {
  robot: ProjectRobot;
  onClose: () => void;
  onReset: (credential: RobotCredential) => void;
};

export function ResetRobotSecretDialog({
  robot,
  onClose,
  onReset,
}: ResetRobotSecretDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  return (
    <ControlDialog
      title="重置机器人密钥"
      subtitle="旧密钥将立即失效"
      submitLabel="重置密钥"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        const response = await mutate<Pick<RobotCredential, "secret"> | null>({
          operation: "robot",
          parameters: { id: robot.id },
          method: "PATCH",
          payload: { secret: "" },
        });
        const secret = response?.secret;
        if (!secret) throw new UserInputError(t("Harbor 未返回机器人密钥"));
        onReset({ name: robot.name, secret });
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>{t("使用旧密钥的流水线需要同步更新")}</span>
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
