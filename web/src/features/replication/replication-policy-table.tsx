import { useLocale } from "../../app/locale-context";
import type { ReplicationPolicy } from "../../app/models";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { SortableHeader } from "../../components/sortable-header";
import { triggerLabel } from "../../components/status-badge-support";
import { createClassNames } from "../../lib/css/class-names";
import { policyDirection, policyRemote } from "./replication-sorting";

import styles from "./replication.module.css";

type ReplicationPolicyTableProps = {
  policies: ReplicationPolicy[];
  sort: string;
  onSort: (sort: string) => void;
  onRun: (policy: ReplicationPolicy) => void;
  onEdit: (policy: ReplicationPolicy) => void;
  onDelete: (policy: ReplicationPolicy) => void;
};

export function ReplicationPolicyTable({
  policies,
  sort,
  onSort,
  onRun,
  onEdit,
  onDelete,
}: ReplicationPolicyTableProps) {
  const { locale, t } = useLocale();
  if (!policies.length) {
    return (
      <EmptyState
        title="暂无复制策略"
        description="创建策略后可以在实例间同步制品。"
        icon="refresh"
      />
    );
  }
  const header = (label: string, field: string, className?: string) => (
    <SortableHeader
      label={label}
      field={field}
      className={resolveClasses(className)}
      currentSort={sort}
      onSort={onSort}
    />
  );
  return (
    <table
      className={resolveClasses(styles.replicationPolicyTable)}
      aria-label={t("复制策略")}
    >
      <thead>
        <tr>
          {header("策略", "name")}
          {header("方向", "direction", "table-cell-center")}
          {header("远端仓库", "remote")}
          {header("触发方式", "trigger", "table-cell-center")}
          {header("状态", "enabled", "table-cell-center")}
          <th />
        </tr>
      </thead>
      <tbody>
        {policies.map((policy) => {
          const direction = policyDirection(policy);
          const remote = policyRemote(policy);
          return (
            <tr key={policy.id}>
              <td>
                <div className={resolveClasses("cell-title")}>
                  <span className={resolveClasses("cell-icon")}>
                    <Icon name="refresh" />
                  </span>
                  <span className={resolveClasses("cell-stack")}>
                    <strong>{policy.name ?? "-"}</strong>
                    <small>
                      {policy.description
                        ? t(policy.description)
                        : `${t("策略")} #${String(policy.id ?? "-")}`}
                    </small>
                  </span>
                </div>
              </td>
              <td className={resolveClasses("table-cell-center")}>
                <span className={resolveClasses("badge badge-blue")}>
                  {locale === "en-US"
                    ? direction
                    : t(direction === "push" ? "推送" : "拉取")}
                </span>
              </td>
              <td>
                <span
                  className={resolveClasses(styles.replicationPolicyRemote)}
                  title={remote}
                >
                  {remote}
                </span>
              </td>
              <td className={resolveClasses("table-cell-center")}>
                {triggerLabel(policy.trigger?.type, t)}
              </td>
              <td className={resolveClasses("table-cell-center")}>
                {policy.enabled ? (
                  <span className={resolveClasses("badge badge-green")}>
                    {t("已启用")}
                  </span>
                ) : (
                  <span className={resolveClasses("badge")}>{t("已停用")}</span>
                )}
              </td>
              <td>
                <div className={resolveClasses("row-actions")}>
                  <button
                    className={resolveClasses("icon-button")}
                    type="button"
                    title={t("立即执行")}
                    aria-label={t("立即执行")}
                    onClick={() => {
                      onRun(policy);
                    }}
                  >
                    <Icon name="play" />
                  </button>
                  <button
                    className={resolveClasses("icon-button")}
                    type="button"
                    title={t("编辑策略")}
                    aria-label={t("编辑策略")}
                    onClick={() => {
                      onEdit(policy);
                    }}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    className={resolveClasses("icon-button danger-icon")}
                    type="button"
                    title={t("删除策略")}
                    aria-label={t("删除策略")}
                    onClick={() => {
                      onDelete(policy);
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "table-cell-center": uiStyles0.tableCellCenter,
  "cell-title": uiStyles0.cellTitle,
  "cell-icon": uiStyles0.cellIcon,
  "cell-stack": uiStyles0.cellStack,
  badge: uiStyles0.badge,
  "badge-blue": uiStyles0.badgeBlue,
  "badge-green": uiStyles0.badgeGreen,
  "row-actions": uiStyles0.rowActions,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
  "danger-icon": uiStyles0.dangerIcon,
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
