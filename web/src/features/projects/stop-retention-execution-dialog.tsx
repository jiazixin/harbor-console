import { useLocale } from "../../app/locale-context";
import type { RetentionExecution, RetentionPolicy } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./project-retention-dialogs-support";

type StopRetentionExecutionDialogProps = {
  policy: RetentionPolicy;
  execution: RetentionExecution;
  onClose: () => void;
  onStopped: () => void;
};

export function StopRetentionExecutionDialog({
  policy,
  execution,
  onClose,
  onStopped,
}: StopRetentionExecutionDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  return (
    <ControlDialog
      title="停止 Tag 保留执行"
      subtitle={`执行 #${String(execution.id)}`}
      submitLabel="停止执行"
      submitIcon="x"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "retention-execution",
          parameters: { id: policy.id, eid: execution.id },
          method: "PATCH",
          payload: { action: "stop" },
        });
        onStopped();
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>
          {t("正在处理的单个任务可能已完成，停止操作不会恢复已经删除的 Tag。")}
        </span>
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
