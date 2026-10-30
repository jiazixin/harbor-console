import { useLocale } from "../../app/locale-context";
import type { PreheatPolicy } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./project-preheat-dialogs-support";

type DeletePreheatPolicyDialogProps = {
  project: string;
  policy: PreheatPolicy;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeletePreheatPolicyDialog({
  project,
  policy,
  onClose,
  onDeleted,
}: DeletePreheatPolicyDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  return (
    <ControlDialog
      title="删除预热策略"
      subtitle={
        locale === "en-US"
          ? `Policy ${policy.name} and its execution history entry will be deleted.`
          : `策略 ${policy.name} 及其执行记录入口将被删除。`
      }
      submitLabel="删除策略"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "preheat-policy",
          parameters: { project, name: policy.name },
          method: "DELETE",
        });
        onDeleted();
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        {t("删除后无法恢复。")}
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
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
