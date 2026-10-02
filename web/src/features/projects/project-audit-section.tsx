import { useEffect, useState } from "react";

import {
  projectAuditDescriptionLabel,
  projectAuditOperationLabel,
} from "../../app/audit-log";
import { useLocale } from "../../app/locale-context";
import type { AuditLog, ControlPagination } from "../../app/models";
import { AuditLogTable } from "../../components/audit-log-table";
import { Pagination } from "../../components/data-table";
import { Icon } from "../../components/icons";
import { ToolbarSearchForm } from "../../components/toolbar-search-form";

export type ProjectAuditError = {
  message: string;
  status?: number;
};

export function ProjectAuditSection({
  logs,
  pagination,
  initialQuery,
  error,
  onSearch,
  onPageChange,
  onRetry,
}: {
  logs: AuditLog[];
  pagination: ControlPagination;
  initialQuery: string;
  error?: ProjectAuditError;
  onSearch: (query: string) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  if (error) {
    const permissionDenied = error.status === 403;
    const unsupported = error.status === 404;
    return (
      <section className="table-shell">
        <div className="empty-table permission-table">
          <strong>
            {t(
              permissionDenied ? "没有访问项目审计的权限" : "项目审计载入失败",
            )}
          </strong>
          <span>
            {t(
              permissionDenied
                ? "当前账号没有查看此项目审计记录的权限。"
                : unsupported
                  ? "当前 Harbor 实例不支持项目级审计接口。"
                  : error.message,
            )}
          </span>
          <button
            className="button button-small"
            type="button"
            onClick={onRetry}
          >
            <Icon name="refresh" />
            <span>{t("重试")}</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="table-shell">
      <div className="table-toolbar">
        <ToolbarSearchForm
          placeholder="按资源或用户筛选"
          value={query}
          onChange={setQuery}
          onSubmit={onSearch}
        />
        <div className="toolbar-spacer" />
        <span className="badge badge-green">{t("扩展审计")}</span>
      </div>
      <div className="table-scroll audit-table-scroll">
        <AuditLogTable
          logs={logs}
          emptyTitle={initialQuery ? "没有匹配的审计记录" : "暂无项目审计记录"}
          emptyDescription={
            initialQuery
              ? "调整筛选条件后重新查询。"
              : "当前筛选条件下没有返回项目级审计事件。"
          }
          operationLabel={projectAuditOperationLabel}
          descriptionLabel={projectAuditDescriptionLabel}
        />
      </div>
      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </section>
  );
}
