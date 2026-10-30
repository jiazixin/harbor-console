import { useState } from "react";
import { useLocale } from "../../app/locale-context";
import type { RetentionPolicy } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import {
  affectedQueries,
  retentionPolicyPayload,
  retentionPolicySubtitle,
} from "./project-retention-dialogs-support";

type RetentionScheduleDialogProps = {
  projectId: number;
  policy: RetentionPolicy;
  onClose: () => void;
  onSaved: () => void;
};

export function RetentionScheduleDialog({
  projectId,
  policy,
  onClose,
  onSaved,
}: RetentionScheduleDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const [algorithm, setAlgorithm] = useState(
    policy.algorithm === "and" ? "and" : "or",
  );
  const [cron, setCron] = useState(policy.trigger?.settings?.cron ?? "");
  return (
    <ControlDialog
      title="编辑保留策略计划"
      subtitle={retentionPolicySubtitle(t, policy.id)}
      submitLabel="保存计划"
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "retention",
          parameters: { id: policy.id },
          method: "PUT",
          payload: retentionPolicyPayload({
            projectId: projectId,
            rules: policy.rules ?? [],
            algorithm: algorithm,
            cron: cron,
          }),
        });
        onSaved();
      }}
    >
      <div className={resolveClasses("form-grid")}>
        <label className={resolveClasses("field")}>
          <span>{t("规则组合方式")}</span>
          <UnifiedSelect
            ariaLabel={t("规则组合方式")}
            name="algorithm"
            value={algorithm}
            options={[
              { value: "or", label: t("匹配任意规则") },
              { value: "and", label: t("同时匹配全部规则") },
            ]}
            onChange={setAlgorithm}
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("执行计划 Cron")}</span>
          <FormInput
            name="cron"
            maxLength={255}
            value={cron}
            placeholder={t("留空表示仅手动执行")}
            onChange={(event) => {
              setCron(event.currentTarget.value);
            }}
          />
          <small className={resolveClasses("field-help")}>
            {t("Harbor 使用含秒字段的 Cron 表达式。")}
          </small>
        </label>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  "unified-select": uiStyles0.unifiedSelect,
  "form-grid": uiStyles0.formGrid,
  field: uiStyles0.field,
  "field-help": uiStyles0.fieldHelp,
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
