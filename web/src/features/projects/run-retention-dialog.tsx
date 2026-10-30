import { useLocale } from "../../app/locale-context";
import type { RetentionPolicy } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./project-retention-dialogs-support";

type RunRetentionDialogProps = {
  policy: RetentionPolicy;
  dryRun: boolean;
  onClose: () => void;
  onStarted: () => void;
};

export function RunRetentionDialog({
  policy,
  dryRun,
  onClose,
  onStarted,
}: RunRetentionDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  return (
    <ControlDialog
      title={dryRun ? "执行 Tag 保留演练" : "正式执行 Tag 保留"}
      subtitle={
        dryRun
          ? "只计算匹配结果，不会删除任何 Tag"
          : "匹配规则的旧 Tag 可能被永久删除"
      }
      submitLabel={dryRun ? "开始演练" : "确认执行"}
      submitIcon="play"
      destructive={!dryRun}
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "retention-executions",
          parameters: { id: policy.id },
          method: "POST",
          payload: {
            dry_run: dryRun,
          },
        });
        onStarted();
      }}
    >
      <div
        className={resolveClasses(
          `notice ${dryRun ? "notice-info" : "notice-danger"}`,
        )}
      >
        <Icon name={dryRun ? "shield" : "alert"} />
        <span>
          {t(
            dryRun
              ? "建议先查看演练结果，再执行正式清理。"
              : "正式执行后无法通过控制台恢复已删除的 Tag。",
          )}
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
