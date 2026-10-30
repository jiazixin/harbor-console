import { type SubmitEvent, useState } from "react";
import { useLocale } from "../../app/locale-context";
import type { ReplicationPolicy } from "../../app/models";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { triggerLabel } from "../../components/status-badge-support";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import type { ExecutionFilterValues } from "./replication-routing";

import styles from "./replication.module.css";

type ReplicationExecutionFilterProps = {
  policies: ReplicationPolicy[];
  values: ExecutionFilterValues;
  onApply: (values: ExecutionFilterValues) => void;
};

export function ReplicationExecutionFilter({
  policies,
  values,
  onApply,
}: ReplicationExecutionFilterProps) {
  const { t } = useLocale();
  const [draft, setDraft] = useState(values);
  const hasActiveFilters = Boolean(
    values.policy_id || values.status || values.trigger,
  );
  const update = (field: keyof ExecutionFilterValues) => (value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  return (
    <form
      className={resolveClasses("table-toolbar filter-toolbar")}
      onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        onApply(draft);
      }}
    >
      <div className={resolveClasses("filter-toolbar-query")}>
        <div className={resolveClasses("filter-toolbar-controls")}>
          <label className={resolveClasses("toolbar-field")}>
            <span>{t("策略")}</span>
            <UnifiedSelect
              name="policy_id"
              ariaLabel={t("策略")}
              className={resolveClasses(
                `toolbar-select ${styles.replicationExecutionPolicySelect}`,
              )}
              value={draft.policy_id}
              options={[
                { value: "", label: t("全部策略") },
                ...policies.map((policy) => ({
                  value: String(policy.id),
                  label: policy.name ?? `#${String(policy.id ?? "-")}`,
                })),
              ]}
              onChange={update("policy_id")}
            />
          </label>
          <label className={resolveClasses("toolbar-field")}>
            <span>{t("状态")}</span>
            <UnifiedSelect
              name="status"
              ariaLabel={t("状态")}
              className={resolveClasses("toolbar-select")}
              value={draft.status}
              options={[
                { value: "", label: t("全部状态") },
                { value: "InProgress", label: t("进行中") },
                { value: "Succeed", label: t("成功") },
                { value: "Failed", label: t("失败") },
                { value: "Stopped", label: t("已停止") },
              ]}
              onChange={update("status")}
            />
          </label>
          <label className={resolveClasses("toolbar-field")}>
            <span>{t("触发方式")}</span>
            <UnifiedSelect
              name="trigger"
              ariaLabel={t("触发方式")}
              className={resolveClasses("toolbar-select")}
              value={draft.trigger}
              options={[
                { value: "", label: t("全部方式") },
                ...["manual", "scheduled", "event_based"].map((value) => ({
                  value,
                  label: triggerLabel(value, t),
                })),
              ]}
              onChange={update("trigger")}
            />
          </label>
          <div className={resolveClasses("filter-toolbar-actions")}>
            <button
              className={resolveClasses("button button-small button-primary")}
              type="submit"
            >
              <Icon name="search" />
              <span>{t("筛选")}</span>
            </button>
            {hasActiveFilters ? (
              <button
                className={resolveClasses("button button-small")}
                type="button"
                onClick={() => {
                  onApply({ policy_id: "", status: "", trigger: "" });
                }}
              >
                {t("取消筛选")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "unified-select": uiStyles0.unifiedSelect,
  "table-toolbar": uiStyles0.tableToolbar,
  "filter-toolbar": uiStyles0.filterToolbar,
  "filter-toolbar-query": uiStyles0.filterToolbarQuery,
  "filter-toolbar-controls": uiStyles0.filterToolbarControls,
  "toolbar-field": uiStyles0.toolbarField,
  "toolbar-select": uiStyles0.toolbarSelect,
  "filter-toolbar-actions": uiStyles0.filterToolbarActions,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
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
