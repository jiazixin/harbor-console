import { useLocale } from "../../app/locale-context";
import type { ReplicationPolicy } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

import { useControlMutation } from "../../app/use-control-mutation";
import { affectedQueries } from "./replication-dialogs-support";

type DeleteReplicationPolicyDialogProps = {
  policy: ReplicationPolicy;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteReplicationPolicyDialog({
  policy,
  onClose,
  onDeleted,
}: DeleteReplicationPolicyDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale } = useLocale();
  return (
    <ControlDialog
      title="删除复制策略"
      subtitle={policy.name}
      submitLabel="删除策略"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "replication-policy",
          parameters: { id: policy.id },
          method: "DELETE",
        });
        onDeleted();
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>
          {locale === "en-US"
            ? `Policy ${policy.name ?? "-"} will be permanently deleted.`
            : `策略 ${policy.name ?? "-"} 将被永久删除。`}
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
