import { useLocale } from "../../app/locale-context";
import type { RetentionPolicy } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import {
  affectedQueries,
  retentionPolicyPayload,
} from "./project-retention-dialogs-support";
import { retentionTemplateSummary } from "./rule-labels";

type DeleteRetentionRuleDialogProps = {
  projectId: number;
  policy: RetentionPolicy;
  ruleIndex: number;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteRetentionRuleDialog({
  projectId,
  policy,
  ruleIndex,
  onClose,
  onDeleted,
}: DeleteRetentionRuleDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const rules = policy.rules ?? [];
  const rule = rules[ruleIndex];
  const label = rule ? retentionTemplateSummary(rule.template) : "";
  const subtitle =
    locale === "en-US"
      ? `The ${t(label)} rule will be deleted.`
      : `将删除“${t(label)}”规则。`;
  return (
    <ControlDialog
      title="删除 Tag 保留规则"
      subtitle={subtitle}
      submitLabel="删除规则"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        const nextRules = rules.filter((_, index) => index !== ruleIndex);
        await mutate({
          operation: "retention",
          parameters: { id: policy.id },
          method: "PUT",
          payload: retentionPolicyPayload({
            projectId: projectId,
            rules: nextRules,
            algorithm: policy.algorithm,
            cron: policy.trigger?.settings?.cron,
          }),
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
