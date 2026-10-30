import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

import {
  projectAuditDescriptionLabel,
  projectAuditOperationLabel,
} from "../../app/audit-log";
import { useLocale } from "../../app/locale-context";
import type { AuditLog, ControlPagination } from "../../app/models";
import { AuditLogTable } from "../../components/audit-log-table";
import { ErrorView } from "../../components/error-view";
import { Pagination } from "../../components/pagination";
import { ToolbarSearchForm } from "../../components/toolbar-search-form";
import { useResettableState } from "../../lib/state/use-resettable-state";

export type ProjectAuditError = {
  message: string;
  status?: number;
};

type ProjectAuditSectionProps = {
  logs: AuditLog[];
  pagination: ControlPagination;
  initialQuery: string;
  error?: ProjectAuditError;
  onSearch: (query: string) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
};

export function ProjectAuditSection({
  logs,
  pagination,
  initialQuery,
  error,
  onSearch,
  onPageChange,
  onRetry,
}: ProjectAuditSectionProps) {
  const { t } = useLocale();
  const [query, setQuery] = useResettableState(initialQuery);

  if (error) {
    const permissionDenied = error.status === 403;
    const unsupported = error.status === 404;
    return (
      <section className={resolveClasses("table-shell")}>
        <ErrorView
          title={
            permissionDenied ? "没有访问项目审计的权限" : "项目审计载入失败"
          }
          message={t(
            (() => {
              if (permissionDenied) {
                return "当前账号没有查看此项目审计记录的权限。";
              }
              if (unsupported) {
                return "当前 Harbor 实例不支持项目级审计接口。";
              }
              return error.message;
            })(),
          )}
          retry={onRetry}
        />
      </section>
    );
  }

  return (
    <section className={resolveClasses("table-shell")}>
      <div className={resolveClasses("table-toolbar")}>
        <ToolbarSearchForm
          placeholder="按资源或用户筛选"
          value={query}
          onChange={setQuery}
          onSubmit={onSearch}
        />
        <div className={resolveClasses("toolbar-spacer")} />
        <span className={resolveClasses("badge badge-green")}>
          {t("扩展审计")}
        </span>
      </div>
      <div className={resolveClasses("table-scroll audit-table-scroll")}>
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

const resolveClasses = createClassNames({
  "audit-log-table": uiStyles0.auditLogTable,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  badge: uiStyles0.badge,
  "badge-green": uiStyles0.badgeGreen,
  "table-scroll": uiStyles0.tableScroll,
  "audit-table-scroll": uiStyles0.auditTableScroll,
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
