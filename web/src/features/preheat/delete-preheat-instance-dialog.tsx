import { useLocale } from "../../app/locale-context";
import type { PreheatInstance } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./preheat-dialogs-support";

type DeletePreheatInstanceDialogProps = {
  instance: PreheatInstance;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeletePreheatInstanceDialog({
  instance,
  onClose,
  onDeleted,
}: DeletePreheatInstanceDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale } = useLocale();
  return (
    <ControlDialog
      title="删除 P2P 实例"
      subtitle={instance.name}
      submitLabel="删除实例"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "preheat-instance",
          parameters: { name: instance.name },
          method: "DELETE",
        });
        onDeleted();
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>
          {locale === "en-US"
            ? `Instance ${instance.name} will be deleted. Preheat policies using it must be updated first.`
            : `实例 ${instance.name} 将被删除，引用它的预热策略必须先调整。`}
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
