import { useLocale } from "../../app/locale-context";
import type { PreheatPolicy } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./project-preheat-dialogs-support";

function runnablePolicyPayload(policy: PreheatPolicy) {
  const payload: Record<string, unknown> = {
    name: policy.name,
    description: policy.description ?? "",
    project_id: policy.project_id ?? 0,
    provider_id: policy.provider_id ?? 0,
    filters:
      typeof policy.filters === "string"
        ? policy.filters
        : JSON.stringify(policy.filters ?? []),
    trigger:
      typeof policy.trigger === "string"
        ? policy.trigger
        : JSON.stringify(policy.trigger ?? {}),
    enabled: policy.enabled !== false,
  };
  if (policy.id > 0) payload.id = policy.id;
  if (typeof policy.extra_attrs === "string" && policy.extra_attrs.trim()) {
    payload.extra_attrs = policy.extra_attrs;
  } else if (policy.extra_attrs && typeof policy.extra_attrs === "object") {
    payload.extra_attrs = JSON.stringify(policy.extra_attrs);
  }
  return payload;
}

type RunPreheatPolicyDialogProps = {
  project: string;
  policy: PreheatPolicy;
  onClose: () => void;
  onStarted: () => void;
};

export function RunPreheatPolicyDialog({
  project,
  policy,
  onClose,
  onStarted,
}: RunPreheatPolicyDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  return (
    <ControlDialog
      title="立即执行 P2P 预热"
      subtitle={policy.name}
      submitLabel="开始预热"
      submitIcon="play"
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "preheat-policy",
          parameters: { project, name: policy.name },
          method: "POST",
          payload: runnablePolicyPayload(policy),
        });
        onStarted();
      }}
    >
      <div className={resolveClasses("notice notice-info")}>
        <span>
          {t("Harbor 将按当前仓库、Tag 与标签筛选条件创建预热任务。")}
        </span>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
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
