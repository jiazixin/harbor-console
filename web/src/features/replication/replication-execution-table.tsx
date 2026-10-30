import { useLocale } from "../../app/locale-context";
import type { ReplicationExecution, ReplicationPolicy } from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { SortableHeader } from "../../components/sortable-header";
import { StatusBadge } from "../../components/status-badge";
import { triggerLabel } from "../../components/status-badge-support";
import { createClassNames } from "../../lib/css/class-names";
import {
  formatDate,
  formatDuration,
  formatNumber,
} from "../../lib/format/formatters";

import styles from "./replication.module.css";

type ReplicationExecutionTableProps = {
  executions: ReplicationExecution[];
  policies: ReplicationPolicy[];
  sort: string;
  onSort: (sort: string) => void;
  onOpen: (execution: ReplicationExecution, policy?: ReplicationPolicy) => void;
};

export function ReplicationExecutionTable({
  executions,
  policies,
  sort,
  onSort,
  onOpen,
}: ReplicationExecutionTableProps) {
  const { locale, t } = useLocale();
  if (!executions.length) {
    return (
      <EmptyState
        title="暂无复制记录"
        description="运行复制策略后，执行结果会显示在这里。"
        icon="refresh"
      />
    );
  }
  const header = ({
    label,
    field,
    className,
    descendingFirst = false,
  }: {
    label: string;
    field: string;
    className?: string;
    descendingFirst?: boolean;
  }) => (
    <SortableHeader
      label={label}
      field={field}
      className={resolveClasses(className)}
      descendingFirst={descendingFirst}
      currentSort={sort}
      onSort={onSort}
    />
  );
  return (
    <table
      className={resolveClasses(styles.replicationExecutionTable)}
      aria-label={t("复制执行")}
    >
      <thead>
        <tr>
          {header({ label: "执行编号", field: "id" })}
          {header({ label: "策略", field: "policy" })}
          {header({
            label: "触发方式",
            field: "trigger",
            className: "table-cell-center",
          })}
          {header({
            label: "状态",
            field: "status",
            className: "table-cell-center",
          })}
          {header({
            label: "任务统计",
            field: "tasks",
            className: "table-cell-number",
            descendingFirst: true,
          })}
          {header({
            label: "开始时间",
            field: "start_time",
            className: "table-cell-time",
            descendingFirst: true,
          })}
          {header({
            label: "耗时",
            field: "duration",
            className: "table-cell-time",
            descendingFirst: true,
          })}
          <th className={resolveClasses("table-cell-center")}>{t("日志")}</th>
        </tr>
      </thead>
      <tbody>
        {executions.map((execution) => {
          const policy = policies.find(
            (item) => item.id === execution.policy_id,
          );
          const policyName =
            policy?.name ??
            `${t("策略")} #${String(execution.policy_id ?? "-")}`;
          return (
            <tr key={execution.id}>
              <td className={resolveClasses("id-cell")}>
                #{execution.id ?? "-"}
              </td>
              <td>
                <div
                  className={resolveClasses(
                    "replication-execution-policy-cell",
                  )}
                >
                  <strong
                    className={resolveClasses("replication-execution-policy")}
                    title={policyName}
                  >
                    {policyName}
                  </strong>
                </div>
              </td>
              <td className={resolveClasses("table-cell-center")}>
                {triggerLabel(execution.trigger, t)}
              </td>
              <td className={resolveClasses("table-cell-center")}>
                <StatusBadge status={execution.status} />
              </td>
              <td className={resolveClasses("table-cell-number")}>
                <span className={resolveClasses("execution-counts")}>
                  <b className={resolveClasses("success-text")}>
                    {formatNumber(execution.succeed, locale)}
                  </b>
                  <b className={resolveClasses("danger-text")}>
                    {formatNumber(execution.failed, locale)}
                  </b>
                  <span>{formatNumber(execution.in_progress, locale)}</span>
                </span>
              </td>
              <td className={resolveClasses("table-cell-time")}>
                {formatDate(execution.start_time, {
                  locale: locale,
                  timeZone: displayTimeZone(),
                })}
              </td>
              <td className={resolveClasses("table-cell-time")}>
                {formatDuration(
                  execution.start_time,
                  execution.end_time,
                  locale,
                )}
              </td>
              <td className={resolveClasses("table-cell-center")}>
                <button
                  className={resolveClasses("icon-button")}
                  type="button"
                  title={t("查看任务")}
                  aria-label={t("查看任务")}
                  onClick={() => {
                    onOpen(execution, policy);
                  }}
                >
                  <Icon name="history" />
                </button>
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
  "status-badge": uiStyles0.statusBadge,
  "table-cell-center": uiStyles0.tableCellCenter,
  "table-cell-number": uiStyles0.tableCellNumber,
  "table-cell-time": uiStyles0.tableCellTime,
  "id-cell": uiStyles0.idCell,
  "replication-execution-policy-cell": uiStyles0.replicationExecutionPolicyCell,
  "replication-execution-policy": uiStyles0.replicationExecutionPolicy,
  "execution-counts": uiStyles0.executionCounts,
  "success-text": uiStyles0.successText,
  "danger-text": uiStyles0.dangerText,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
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
