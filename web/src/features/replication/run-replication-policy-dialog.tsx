import { useLocale } from "../../app/locale-context";
import type { ReplicationPolicy } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

import { useControlMutation } from "../../app/use-control-mutation";
import { affectedQueries } from "./replication-dialogs-support";

type RunReplicationPolicyDialogProps = {
  policy: ReplicationPolicy;
  onClose: () => void;
  onStarted: () => void;
};

export function RunReplicationPolicyDialog({
  policy,
  onClose,
  onStarted,
}: RunReplicationPolicyDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  return (
    <ControlDialog
      title="立即执行复制策略"
      subtitle={policy.name}
      submitLabel="启动复制"
      submitIcon="play"
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "replication-executions",
          parameters: {},
          method: "POST",
          payload: {
            policy_id: policy.id,
          },
        });
        onStarted();
      }}
    >
      <div className={resolveClasses("notice notice-info")}>
        <Icon name="info" />
        <span>
          {t("Harbor 将立即创建一次复制执行，可在执行记录中查看进度。")}
        </span>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  notice: uiStyles0.notice,
  "notice-info": uiStyles0.noticeInfo,
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
