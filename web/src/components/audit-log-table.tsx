import { auditResourceTypeLabel, formatAuditDate } from "../app/audit-log";
import { useLocale } from "../app/locale-context";
import type { AuditLog, Locale } from "../app/models";
import { SortableHeader, StableTableColumns } from "./data-table";
import { EmptyState } from "./empty-state";
import type { IconName } from "./icons";

type Translate = (source: string) => string;

export function AuditLogTable({
  logs,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  sort,
  onSort,
  operationLabel,
  descriptionLabel,
}: {
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
}) {
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
    <table className="data-table-stable audit-log-table">
      <StableTableColumns
        widths={["144px", "12%", "24%", "9%", "10%", "22%", "96px"]}
      />
      <thead>
        <tr>
          {sort && onSort ? (
            <SortableHeader
              label="时间"
              field="op_time"
              className="audit-time table-cell-time"
              descendingFirst
              currentSort={sort}
              onSort={onSort}
            />
          ) : (
            <th className="audit-time table-cell-time">{t("时间")}</th>
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
              <td className="audit-time table-cell-time">
                {formatAuditDate(log.op_time, locale)}
              </td>
              <td>
                <strong>{log.username ?? t("系统")}</strong>
              </td>
              <td>
                <span className="cell-stack">
                  <span>
                    <span
                      className="badge badge-blue audit-event-badge"
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
                  className={`badge ${
                    log.operation_result === true
                      ? "badge-green"
                      : log.operation_result === false
                        ? "badge-red"
                        : ""
                  }`.trim()}
                >
                  {t(
                    log.operation_result === true
                      ? "成功"
                      : log.operation_result === false
                        ? "失败"
                        : "未记录",
                  )}
                </span>
              </td>
              <td>{auditResourceTypeLabel(log.resource_type, t)}</td>
              <td>
                <span className="mono">{log.resource ?? "-"}</span>
              </td>
              <td className="id-cell">#{log.id}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
