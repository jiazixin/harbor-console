import { type SubmitEvent, useEffect, useMemo } from "react";
import { controlApi } from "../../app/api-client";
import {
  auditQueryValue,
  globalAuditDescriptionLabel,
  globalAuditOperationLabel,
} from "../../app/audit-log";
import type { ConsoleRoute } from "../../app/console-route";
import { useLocale } from "../../app/locale-context";
import type { AuditLog, AuditLogEvent } from "../../app/models";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { AuditLogTable } from "../../components/audit-log-table";
import { DemoBanner } from "../../components/demo-banner";
import { ErrorView } from "../../components/error-view";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import { PageHeader } from "../../components/page-header";
import { Pagination } from "../../components/pagination";
import { RefreshButton } from "../../components/refresh-button";
import { SectionHeading } from "../../components/section-heading";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { useResettableState } from "../../lib/state/use-resettable-state";
import { auditKeys } from "./audit-keys";
import styles from "./audit.module.css";

type AuditResultFilter = "" | "failed" | "success";

type AuditFilters = {
  username: string;
  resource: string;
  operation: string;
  result: AuditResultFilter;
};

type AuditRouteState = AuditFilters & {
  page: number;
  pageSize: number;
  sort: "op_time" | "-op_time";
};

function parseAuditQuery(query: URLSearchParams): AuditRouteState {
  const pageValue = Number(query.get("page"));
  const pageSizeValue = Number(query.get("page_size"));
  const result = query.get("result");
  return {
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    pageSize: [20, 50, 100].includes(pageSizeValue) ? pageSizeValue : 50,
    username: query.get("username") ?? "",
    resource: query.get("resource") ?? "",
    operation: query.get("operation") ?? "",
    result: result === "success" || result === "failed" ? result : "",
    sort: query.get("sort") === "op_time" ? "op_time" : "-op_time",
  };
}

export function auditControlQuery(filters: AuditFilters): string {
  const values: string[] = [];
  if (filters.username)
    values.push(`username=~${auditQueryValue(filters.username)}`);
  if (filters.resource)
    values.push(`resource=~${auditQueryValue(filters.resource)}`);
  if (filters.operation)
    values.push(`operation=${auditQueryValue(filters.operation)}`);
  if (filters.result)
    values.push(`op_result=${String(filters.result === "success")}`);
  return values.join(",");
}

function formString(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function auditPath({
  page,
  pageSize,
  filters,
  sort = "-op_time",
}: {
  page: number;
  pageSize: number;
  filters: AuditFilters;
  sort?: "op_time" | "-op_time";
}): string {
  const query = new URLSearchParams();
  if (filters.username) query.set("username", filters.username);
  if (filters.resource) query.set("resource", filters.resource);
  if (filters.operation) query.set("operation", filters.operation);
  if (filters.result) query.set("result", filters.result);
  if (page > 1) query.set("page", String(page));
  if (pageSize !== 50) query.set("page_size", String(pageSize));
  if (sort !== "-op_time") query.set("sort", sort);
  return `audit${query.size ? `?${query}` : ""}`;
}

type AuditFilterFormProps = {
  values: AuditRouteState;
  operations: string[];
  navigate: (path: string) => void;
};

function AuditFilterForm({
  values,
  operations,
  navigate,
}: AuditFilterFormProps) {
  const { locale, t } = useLocale();
  const [resource, setResource] = useResettableState(values.resource);
  const [username, setUsername] = useResettableState(values.username);
  const [operation, setOperation] = useResettableState(values.operation);
  const [result, setResult] = useResettableState<AuditResultFilter>(
    values.result,
  );

  const activeFilters = Boolean(
    values.username || values.resource || values.operation || values.result,
  );

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submittedResult = formString(form, "result");
    navigate(
      auditPath({
        page: 1,
        pageSize: values.pageSize,
        filters: {
          username: formString(form, "username").trim(),
          resource: formString(form, "resource").trim(),
          operation: formString(form, "operation"),
          result:
            submittedResult === "success" || submittedResult === "failed"
              ? submittedResult
              : "",
        },
        sort: values.sort,
      }),
    );
  }

  return (
    <form
      className={resolveClasses(
        `table-toolbar ${styles.auditFilterForm} filter-toolbar`,
      )}
      onSubmit={submit}
    >
      <div className={resolveClasses("filter-toolbar-query")}>
        <div className={resolveClasses("filter-toolbar-controls")}>
          <div className={resolveClasses("toolbar-search")}>
            <Icon name="search" />
            <FormInput
              name="username"
              type="search"
              maxLength={200}
              value={username}
              placeholder={t("用户名")}
              aria-label={t("按用户名筛选")}
              onChange={(event) => {
                setUsername(event.currentTarget.value);
              }}
            />
          </div>
          <div
            className={resolveClasses(
              `toolbar-search ${styles.auditResourceSearch}`,
            )}
          >
            <Icon name="database" />
            <FormInput
              name="resource"
              type="search"
              maxLength={200}
              value={resource}
              placeholder={t("资源名称")}
              aria-label={t("按资源名称筛选")}
              onChange={(event) => {
                setResource(event.currentTarget.value);
              }}
            />
          </div>
          <label
            className={resolveClasses(
              `toolbar-field ${styles.auditOperationFilter}`,
            )}
          >
            <span>{t("事件")}</span>
            <UnifiedSelect
              name="operation"
              ariaLabel={t("按事件筛选")}
              className={resolveClasses("toolbar-select")}
              value={operation}
              options={[
                { value: "", label: t("全部事件") },
                ...operations.map((value) => ({
                  value,
                  label: globalAuditOperationLabel(value, locale, t),
                })),
              ]}
              onChange={setOperation}
            />
          </label>
          <label
            className={resolveClasses("toolbar-field audit-result-filter")}
          >
            <span>{t("结果")}</span>
            <UnifiedSelect
              name="result"
              ariaLabel={t("按结果筛选")}
              className={resolveClasses("toolbar-select")}
              value={result}
              options={[
                { value: "", label: t("全部结果") },
                { value: "success", label: t("成功") },
                { value: "failed", label: t("失败") },
              ]}
              onChange={setResult}
            />
          </label>
        </div>
        <div className={resolveClasses("filter-toolbar-actions")}>
          <button
            className={resolveClasses("button button-small button-primary")}
            type="submit"
          >
            <Icon name="search" />
            <span>{t("筛选")}</span>
          </button>
          {activeFilters ? (
            <button
              className={resolveClasses("button button-small")}
              type="button"
              onClick={() => {
                navigate(
                  auditPath({
                    page: 1,
                    pageSize: values.pageSize,
                    filters: {
                      username: "",
                      resource: "",
                      operation: "",
                      result: "",
                    },
                    sort: values.sort,
                  }),
                );
              }}
            >
              <Icon name="x" />
              <span>{t("取消筛选")}</span>
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

type AuditPageProps = {
  route: ConsoleRoute;
  demo: boolean;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => void;
};

export function AuditPage({
  route,
  demo,
  refreshing,
  navigate,
  onRefresh,
}: AuditPageProps) {
  const { locale, t } = useLocale();
  const loadKey = route.query.toString();
  const values = useMemo(
    () => parseAuditQuery(new URLSearchParams(loadKey)),
    [loadKey],
  );
  const eventsQuery = useAuditEventData();
  const events = eventsQuery.data;
  const logsQuery = useAuditData({ values });
  const collection = logsQuery.data;
  const error = logsQuery.error;
  const reload = logsQuery.reload;

  useEffect(() => {
    if (!collection || logsQuery.loading) return;
    const totalPages = Math.max(
      1,
      Math.ceil(
        collection.pagination.total /
          Math.max(1, collection.pagination.page_size),
      ),
    );
    if (values.page <= totalPages) return;
    const frame = window.requestAnimationFrame(() => {
      navigate(
        auditPath({
          page: totalPages,
          pageSize: values.pageSize,
          filters: values,
        }),
      );
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [collection, logsQuery.loading, navigate, values]);

  const logs = useMemo(() => collection?.items ?? [], [collection]);
  const activeFilters = Boolean(
    values.username || values.resource || values.operation || values.result,
  );
  const operations = (() =>
    [
      ...new Set(
        [
          ...(events ?? []).map((event) => event.event_type ?? ""),
          ...logs.map((log) => log.operation ?? ""),
        ].filter(Boolean),
      ),
    ].sort((left, right) => left.localeCompare(right, locale)))();
  return (
    <>
      <PageHeader
        title="审计日志"
        subtitle={t("追踪用户和自动化账号的资源操作")}
        actions={
          <RefreshButton
            refreshing={refreshing || (!collection && !error)}
            onRefresh={() => {
              reload();
              onRefresh();
            }}
          />
        }
      />
      {demo ? <DemoBanner /> : null}
      {eventsQuery.error ? (
        <ErrorView message={eventsQuery.error} retry={eventsQuery.reload} />
      ) : null}
      {!collection && !error ? (
        <section className={resolveClasses("table-shell")}>
          <div
            className={resolveClasses("route-loading")}
            role="status"
            aria-label={t("正在载入")}
          >
            <span
              className={resolveClasses("spinner spinner-small")}
              aria-hidden="true"
            />
          </div>
        </section>
      ) : null}
      {error ? (
        <ErrorView
          title="审计日志载入失败"
          message={error}
          retry={() => {
            reload();
            onRefresh();
          }}
        />
      ) : null}
      {collection ? (
        <>
          <SectionHeading
            title="审计日志"
            total={collection.pagination.total}
            zhUnit="条"
            enUnit="entries"
          />
          <section className={resolveClasses("table-shell")}>
            <AuditFilterForm
              values={values}
              operations={operations}
              navigate={navigate}
            />
            <div>
              <div
                className={resolveClasses("table-scroll audit-table-scroll")}
              >
                <AuditLogTable
                  logs={logs}
                  emptyTitle={
                    activeFilters ? "没有匹配的审计记录" : "暂无可见审计记录"
                  }
                  emptyDescription={
                    activeFilters
                      ? "调整筛选条件后重新查询。"
                      : "当前 Harbor 实例没有返回该账号可见的审计记录。"
                  }
                  emptyIcon="history"
                  sort={values.sort}
                  onSort={(sort) => {
                    navigate(
                      auditPath({
                        page: 1,
                        pageSize: values.pageSize,
                        filters: values,
                        sort: sort as "op_time" | "-op_time",
                      }),
                    );
                  }}
                  operationLabel={globalAuditOperationLabel}
                  descriptionLabel={globalAuditDescriptionLabel}
                />
              </div>
            </div>
            <Pagination
              pagination={collection.pagination}
              onPageChange={(page) => {
                navigate(
                  auditPath({
                    page: page,
                    pageSize: values.pageSize,
                    filters: values,
                    sort: values.sort,
                  }),
                );
              }}
              pageSizeOptions={[20, 50, 100]}
              onPageSizeChange={(pageSize) => {
                navigate(
                  auditPath({
                    page: 1,
                    pageSize: pageSize,
                    filters: values,
                    sort: values.sort,
                  }),
                );
              }}
            />
          </section>
        </>
      ) : null}
    </>
  );
}

const resolveClasses = createClassNames({
  "audit-log-table": uiStyles0.auditLogTable,
  icon: uiStyles0.icon,
  "page-header": uiStyles0.pageHeader,
  "refresh-button": uiStyles0.refreshButton,
  "section-heading": uiStyles0.sectionHeading,
  "unified-select": uiStyles0.unifiedSelect,
  "table-toolbar": uiStyles0.tableToolbar,
  "filter-toolbar": uiStyles0.filterToolbar,
  "filter-toolbar-query": uiStyles0.filterToolbarQuery,
  "filter-toolbar-controls": uiStyles0.filterToolbarControls,
  "toolbar-search": uiStyles0.toolbarSearch,
  "toolbar-field": uiStyles0.toolbarField,
  "toolbar-select": uiStyles0.toolbarSelect,
  "filter-toolbar-actions": uiStyles0.filterToolbarActions,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  "table-shell": uiStyles0.tableShell,
  "route-loading": uiStyles0.routeLoading,
  spinner: uiStyles0.spinner,
  "spinner-small": uiStyles0.spinnerSmall,
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

function useAuditData({ values }: { values: AuditRouteState }) {
  return useLoadedQuery(auditKeys.logs(values), (signal) =>
    controlApi.list<AuditLog>(
      "audit-logs",
      {
        page: values.page,
        page_size: values.pageSize,
        sort: values.sort,
        q: auditControlQuery(values),
      },
      signal,
    ),
  );
}

function useAuditEventData() {
  return useLoadedQuery(auditKeys.events, (signal) =>
    controlApi
      .data<AuditLogEvent[]>("audit-log-events", {}, signal)
      .then((data) => data ?? []),
  );
}
