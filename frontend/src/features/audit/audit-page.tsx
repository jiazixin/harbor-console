import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  globalAuditDescriptionLabel,
  globalAuditOperationLabel,
} from "../../app/audit-log";
import { ApiError, controlApi } from "../../app/api-client";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type { AuditLog, AuditLogEvent, ControlList } from "../../app/models";
import { AuditLogTable } from "../../components/audit-log-table";
import { Pagination } from "../../components/data-table";
import { Icon } from "../../components/icons";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
  SectionHeading,
} from "../../components/page-elements";
import { UnifiedSelect } from "../../components/unified-select";

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

export function parseAuditRoute(route: ConsoleRoute): AuditRouteState {
  return parseAuditQuery(route.query);
}

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

export function auditQueryValue(value: string): string {
  const normalized = value.trim().slice(0, 200);
  if (/^[A-Za-z0-9_.@:/+-]+$/.test(normalized)) return normalized;
  return `"${normalized.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
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

export function auditPath(
  page: number,
  pageSize: number,
  filters: AuditFilters,
  sort: "op_time" | "-op_time" = "-op_time",
): string {
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

function AuditFilterForm({
  values,
  operations,
  navigate,
}: {
  values: AuditRouteState;
  operations: string[];
  navigate: (path: string) => void;
}) {
  const { locale, t } = useLocale();
  const [resource, setResource] = useState(values.resource);
  const [username, setUsername] = useState(values.username);
  const [operation, setOperation] = useState(values.operation);
  const [result, setResult] = useState<AuditResultFilter>(values.result);

  useEffect(() => setResource(values.resource), [values.resource]);
  useEffect(() => setUsername(values.username), [values.username]);
  useEffect(() => setOperation(values.operation), [values.operation]);
  useEffect(() => setResult(values.result), [values.result]);

  const activeFilters = Boolean(
    values.username || values.resource || values.operation || values.result,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submittedResult = formString(form, "result");
    navigate(
      auditPath(
        1,
        values.pageSize,
        {
          username: formString(form, "username").trim(),
          resource: formString(form, "resource").trim(),
          operation: formString(form, "operation"),
          result:
            submittedResult === "success" || submittedResult === "failed"
              ? submittedResult
              : "",
        },
        values.sort,
      ),
    );
  }

  return (
    <form
      className="table-toolbar audit-filter-form filter-toolbar"
      onSubmit={submit}
    >
      <div className="filter-toolbar-query">
        <div className="filter-toolbar-controls">
          <div className="toolbar-search">
            <Icon name="search" />
            <input
              name="username"
              type="search"
              maxLength={200}
              value={username}
              placeholder={t("用户名")}
              aria-label={t("按用户名筛选")}
              onChange={(event) => setUsername(event.currentTarget.value)}
            />
          </div>
          <div className="toolbar-search audit-resource-search">
            <Icon name="database" />
            <input
              name="resource"
              type="search"
              maxLength={200}
              value={resource}
              placeholder={t("资源名称")}
              aria-label={t("按资源名称筛选")}
              onChange={(event) => setResource(event.currentTarget.value)}
            />
          </div>
          <label className="toolbar-field audit-operation-filter">
            <span>{t("事件")}</span>
            <UnifiedSelect
              name="operation"
              ariaLabel={t("按事件筛选")}
              className="toolbar-select"
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
          <label className="toolbar-field audit-result-filter">
            <span>{t("结果")}</span>
            <UnifiedSelect
              name="result"
              ariaLabel={t("按结果筛选")}
              className="toolbar-select"
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
        <div className="filter-toolbar-actions">
          <button className="button button-small button-primary" type="submit">
            <Icon name="search" />
            <span>{t("筛选")}</span>
          </button>
          {activeFilters ? (
            <button
              className="button button-small"
              type="button"
              onClick={() =>
                navigate(
                  auditPath(
                    1,
                    values.pageSize,
                    {
                      username: "",
                      resource: "",
                      operation: "",
                      result: "",
                    },
                    values.sort,
                  ),
                )
              }
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

export function AuditPage({
  route,
  demo,
  refreshing,
  navigate,
  onRefresh,
}: {
  route: ConsoleRoute;
  demo: boolean;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => void;
}) {
  const { locale, t } = useLocale();
  const loadKey = route.query.toString();
  const values = useMemo(
    () => parseAuditQuery(new URLSearchParams(loadKey)),
    [loadKey],
  );
  const [collection, setCollection] = useState<ControlList<AuditLog>>();
  const [events, setEvents] = useState<AuditLogEvent[]>([]);
  const [error, setError] = useState<{ message: string; status?: number }>();
  const [version, setVersion] = useState(0);
  const requestVersion = useRef(0);
  const eventCache = useRef<AuditLogEvent[] | undefined>(undefined);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const currentVersion = requestVersion.current + 1;
    requestVersion.current = currentVersion;
    setError(undefined);
    const filters: AuditFilters = values;
    const eventsPromise = eventCache.current
      ? Promise.resolve(eventCache.current)
      : controlApi
          .data<AuditLogEvent[]>("audit-log-events", {}, controller.signal)
          .then((data) => data ?? [])
          .catch(() => []);
    void Promise.all([
      controlApi.list<AuditLog>(
        "audit-logs",
        {
          page: values.page,
          page_size: values.pageSize,
          sort: values.sort,
          q: auditControlQuery(filters),
        },
        controller.signal,
      ),
      eventsPromise,
    ])
      .then(([nextCollection, nextEvents]) => {
        if (
          controller.signal.aborted ||
          requestVersion.current !== currentVersion
        )
          return;
        const totalPages = Math.max(
          1,
          Math.ceil(
            nextCollection.pagination.total /
              Math.max(1, nextCollection.pagination.page_size),
          ),
        );
        if (values.page > totalPages) {
          navigate(auditPath(totalPages, values.pageSize, values));
          return;
        }
        eventCache.current = nextEvents;
        setEvents(nextEvents);
        setCollection(nextCollection);
      })
      .catch((loadError: unknown) => {
        if (
          controller.signal.aborted ||
          requestVersion.current !== currentVersion
        )
          return;
        setError({
          message:
            loadError instanceof Error ? loadError.message : String(loadError),
          status: loadError instanceof ApiError ? loadError.status : undefined,
        });
      });
    return () => controller.abort();
  }, [loadKey, navigate, values, version]);

  const logs = collection?.items ?? [];
  const activeFilters = Boolean(
    values.username || values.resource || values.operation || values.result,
  );
  const operations = useMemo(
    () =>
      [
        ...new Set(
          [
            ...events.map((event) => event.event_type ?? ""),
            ...logs.map((log) => log.operation ?? ""),
          ].filter(Boolean),
        ),
      ].sort((left, right) => left.localeCompare(right, locale)),
    [events, locale, logs],
  );
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
      {!collection && !error ? (
        <section className="table-shell">
          <div
            className="route-loading"
            role="status"
            aria-label={t("正在载入")}
          >
            <span className="spinner spinner-small" aria-hidden="true" />
          </div>
        </section>
      ) : null}
      {error ? (
        <div className="error-state" role="alert">
          <div>
            <span className="state-icon">
              <Icon name="alert" />
            </span>
            <h2>
              {t(
                error.status === 403 ? "无权访问审计日志" : "审计日志载入失败",
              )}
            </h2>
            <p>{error.message}</p>
            <button
              className="button button-small"
              type="button"
              onClick={() => {
                reload();
                onRefresh();
              }}
            >
              <Icon name="refresh" />
              <span>{t("重试")}</span>
            </button>
          </div>
        </div>
      ) : null}
      {collection ? (
        <section className="table-shell">
          <AuditFilterForm
            values={values}
            operations={operations}
            navigate={navigate}
          />
          <SectionHeading
            title="审计日志"
            total={collection.pagination.total}
            zhUnit="条"
            enUnit="entries"
          />
          <div>
            <div className="table-scroll audit-table-scroll">
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
                onSort={(sort) =>
                  navigate(
                    auditPath(
                      1,
                      values.pageSize,
                      values,
                      sort as "op_time" | "-op_time",
                    ),
                  )
                }
                operationLabel={globalAuditOperationLabel}
                descriptionLabel={globalAuditDescriptionLabel}
              />
            </div>
          </div>
          <Pagination
            pagination={collection.pagination}
            onPageChange={(page) =>
              navigate(auditPath(page, values.pageSize, values, values.sort))
            }
            pageSizeOptions={[20, 50, 100]}
            onPageSizeChange={(pageSize) =>
              navigate(auditPath(1, pageSize, values, values.sort))
            }
          />
        </section>
      ) : null}
    </>
  );
}
