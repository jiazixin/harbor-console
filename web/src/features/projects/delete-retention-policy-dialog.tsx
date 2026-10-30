import { useLocale } from "../../app/locale-context";
import type { RetentionPolicy } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./project-retention-dialogs-support";

type DeleteRetentionPolicyDialogProps = {
  policy: RetentionPolicy;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteRetentionPolicyDialog({
  policy,
  onClose,
  onDeleted,
}: DeleteRetentionPolicyDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  return (
    <ControlDialog
      title="删除 Tag 保留策略"
      subtitle="该项目将不再自动清理旧 Tag，已有制品不会在此操作中删除。"
      submitLabel="删除策略"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "retention",
          parameters: { id: policy.id },
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
