import { auditResourceTypeLabel } from "../app/audit-log";
import { useLocale } from "../app/locale-context";
import type { AuditLog, Locale } from "../app/models";
import { displayTimeZone } from "../app/preferences";
import { createClassNames } from "../lib/css/class-names";
import { formatTimestamp } from "../lib/format/formatters";
import uiStyles1 from "./audit-log-table.module.css";
import { EmptyState } from "./empty-state";
import type { IconName } from "./icons-support";
import { OverflowText } from "./overflow-text";
import uiStyles0 from "./shared-ui.module.css";
import { SortableHeader } from "./sortable-header";
import { StableTableColumns } from "./stable-table-columns";

type Translate = (source: string) => string;

type AuditLogTableProps = {
  logs: AuditLog[];
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: IconName;
  sort?: string;
  onSort?: (sort: string) => void;
  operationLabel: (
    value: string | undefined,
    locale: Locale,
    translate: Translate,
  ) => string;
  descriptionLabel: (
    log: AuditLog,
    locale: Locale,
    translate: Translate,
  ) => string;
};

export function AuditLogTable({
  logs,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  sort,
  onSort,
  operationLabel,
  descriptionLabel,
}: AuditLogTableProps) {
  const { locale, t } = useLocale();

  if (!logs.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
      />
    );
  }

  return (
    <table className={resolveClasses("data-table-stable audit-log-table")}>
      <StableTableColumns
        widths={["144px", "12%", "24%", "112px", "10%", "22%", "96px"]}
      />
      <thead>
        <tr>
          {sort && onSort ? (
            <SortableHeader
              label="时间"
              field="op_time"
              className={resolveClasses("audit-time table-cell-time")}
              descendingFirst
              currentSort={sort}
              onSort={onSort}
            />
          ) : (
            <th className={resolveClasses("audit-time table-cell-time")}>
              {t("时间")}
            </th>
          )}
          <th>{t("用户")}</th>
          <th>{t("事件")}</th>
          <th>{t("结果")}</th>
          <th>{t("资源类型")}</th>
          <th>{t("资源")}</th>
          <th>{t("记录编号")}</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log, index) => {
          const operation = operationLabel(log.operation, locale, t);
          const description = descriptionLabel(log, locale, t);
          return (
            <tr key={`${String(log.id)}-${String(index)}`}>
              <td className={resolveClasses("audit-time table-cell-time")}>
                {formatTimestamp(log.op_time, {
                  locale: locale,
                  timeZone: displayTimeZone(),
                })}
              </td>
              <td>
                <strong>{log.username ?? t("系统")}</strong>
              </td>
              <td>
                <span className={resolveClasses("cell-stack")}>
                  <span>
                    <span
                      className={resolveClasses(
                        "badge badge-blue audit-event-badge",
                      )}
                      title={operation}
                    >
                      {operation}
                    </span>
                  </span>
                  <small title={description}>{description}</small>
                </span>
              </td>
              <td>
                <span
                  className={resolveClasses(
                    `badge ${(() => {
                      if (log.operation_result === true) {
                        return "badge-green";
                      }
                      if (log.operation_result === false) {
                        return "badge-red";
                      }
                      return "";
                    })()}`.trim(),
                  )}
                >
                  {t(
                    (() => {
                      if (log.operation_result === true) {
                        return "成功";
                      }
                      if (log.operation_result === false) {
                        return "失败";
                      }
                      return "未记录";
                    })(),
                  )}
                </span>
              </td>
              <td>{auditResourceTypeLabel(log.resource_type, t)}</td>
              <td>
                <OverflowText className={resolveClasses("mono")}>
                  {log.resource ?? "-"}
                </OverflowText>
              </td>
              <td className={resolveClasses("id-cell")}>#{log.id}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  "overflow-text": uiStyles0.overflowText,
  "data-table-stable": uiStyles0.dataTableStable,
  "audit-log-table": uiStyles0.auditLogTable,
  "table-cell-time": uiStyles0.tableCellTime,
  "cell-stack": uiStyles0.cellStack,
  badge: uiStyles0.badge,
  "badge-blue": uiStyles0.badgeBlue,
  "badge-green": uiStyles0.badgeGreen,
  "badge-red": uiStyles0.badgeRed,
  mono: uiStyles0.mono,
  "id-cell": uiStyles0.idCell,
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
  "audit-time": uiStyles1.auditTime,
});
