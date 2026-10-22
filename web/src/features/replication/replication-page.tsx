import { useMemo } from "react";

import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type {
  ProjectLabel,
  Registry,
  ReplicationAdapterInfo,
  ReplicationExecution,
  ReplicationPolicy,
} from "../../app/models";
import { ContentTransition } from "../../components/content-transition";
import { Pagination } from "../../components/data-table";
import { ErrorView } from "../../components/feedback";
import { Icon } from "../../components/icons";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
  SectionHeading,
} from "../../components/page-elements";
import {
  type ExecutionFilterValues,
  pageSizeOptions,
  parseReplicationRoute,
  replicationPath,
  sortQueryValue,
} from "./replication-routing";
import { sortExecutions, sortPolicies } from "./replication-sorting";
import {
  ReplicationExecutionFilter,
  ReplicationExecutionTable,
  ReplicationPolicyFilter,
  ReplicationPolicyTable,
} from "./replication-tables";
import { useReplicationData } from "./use-replication-data";

export type ReplicationAction =
  | {
      kind: "create";
      registries: Registry[];
      labels: ProjectLabel[];
      localInfo?: ReplicationAdapterInfo;
    }
  | {
      kind: "edit";
      policy: ReplicationPolicy;
      registries: Registry[];
      labels: ProjectLabel[];
      localInfo?: ReplicationAdapterInfo;
    }
  | { kind: "run"; policy: ReplicationPolicy }
  | { kind: "delete"; policy: ReplicationPolicy }
  | {
      kind: "execution";
      execution: ReplicationExecution;
      policy?: ReplicationPolicy;
    };

function TableLoading() {
  return (
    <section className="table-shell">
      <div className="loading-state">
        <div>
          <span className="spinner" />
        </div>
      </div>
    </section>
  );
}

export function ReplicationPage({
  route,
  demo,
  refreshing,
  navigate,
  onRefresh,
  onAction,
}: {
  route: ConsoleRoute;
  demo: boolean;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => void;
  onAction: (action: ReplicationAction) => void;
}) {
  const { locale, t } = useLocale();
  const { tab, page, pageSize, sort, policyFilter, executionFilters } =
    parseReplicationRoute(route);
  const replicationData = useReplicationData(
    tab,
    policyFilter,
    executionFilters,
  );
  const { policies, executions, registries, labels, localInfo } =
    replicationData;

  const sortedPolicies = useMemo(
    () => sortPolicies(policies ?? [], sort, locale),
    [locale, policies, sort],
  );
  const sortedExecutions = useMemo(
    () => sortExecutions(executions ?? [], policies ?? [], sort, locale),
    [executions, locale, policies, sort],
  );
  const total =
    tab === "policies" ? sortedPolicies.length : sortedExecutions.length;
  const pageStart = (page - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const editorContext = { registries, labels, localInfo };

  // Filters, sorting and paging live in the route, so every change navigates.
  const listQuery = (nextSort = sort): Record<string, string> =>
    tab === "policies"
      ? { q: policyFilter, sort: sortQueryValue(tab, nextSort) }
      : { ...executionFilters, sort: sortQueryValue(tab, nextSort) };
  const showPage = (nextPage: number, nextPageSize = pageSize) =>
    navigate(replicationPath(tab, nextPage, nextPageSize, listQuery()));
  const sortBy = (nextSort: string) =>
    navigate(replicationPath(tab, 1, pageSize, listQuery(nextSort)));
  const filterPolicies = (query: string) =>
    navigate(
      replicationPath("policies", 1, pageSize, {
        q: query,
        sort: sortQueryValue("policies", sort),
      }),
    );
  const filterExecutions = (filters: ExecutionFilterValues) =>
    navigate(
      replicationPath("executions", 1, pageSize, {
        ...filters,
        sort: sortQueryValue("executions", sort),
      }),
    );

  const listPagination = (
    <Pagination
      pagination={{ page, page_size: pageSize, total }}
      onPageChange={(nextPage) => showPage(nextPage)}
      pageSizeOptions={pageSizeOptions}
      onPageSizeChange={(nextPageSize) => showPage(1, nextPageSize)}
    />
  );
  const waitingForList =
    replicationData.loading &&
    !replicationData.error &&
    (tab === "policies" ? !policies : !executions);

  return (
    <>
      <PageHeader
        title="复制管理"
        subtitle={t("检查复制策略和最近执行记录")}
        actions={
          <>
            <RefreshButton
              refreshing={refreshing || !policies}
              onRefresh={() => {
                replicationData.reload();
                onRefresh();
              }}
            />
            <button
              className="button button-small button-primary"
              type="button"
              onClick={() => onAction({ kind: "create", ...editorContext })}
            >
              <Icon name="plus" />
              <span>{t("新建策略")}</span>
            </button>
          </>
        }
      />
      {demo ? <DemoBanner /> : null}
      <nav
        className="resource-tabs replication-list-tabs"
        aria-label={t("复制管理页面")}
      >
        <a
          href="#/replication"
          className={tab === "policies" ? "active" : ""}
          aria-current={tab === "policies" ? "page" : undefined}
        >
          <Icon name="settings" />
          <span>{t("复制策略")}</span>
        </a>
        <a
          href="#/replication?tab=executions"
          className={tab === "executions" ? "active" : ""}
          aria-current={tab === "executions" ? "page" : undefined}
        >
          <Icon name="history" />
          <span>{t("执行记录")}</span>
        </a>
      </nav>
      <ContentTransition mode={tab}>
        {replicationData.error ? (
          <ErrorView
            title="复制数据载入失败"
            message={replicationData.error}
            retry={replicationData.reload}
          />
        ) : null}
        {waitingForList ? <TableLoading /> : null}
        {policies && tab === "policies" ? (
          <section className="replication-policies-section">
            <SectionHeading
              title="复制策略"
              total={sortedPolicies.length}
              zhUnit="条"
              enUnit="entries"
            />
            <div className="table-shell">
              <ReplicationPolicyFilter
                query={policyFilter}
                onSearch={filterPolicies}
              />
              <div className="table-scroll">
                <ReplicationPolicyTable
                  policies={sortedPolicies.slice(pageStart, pageEnd)}
                  sort={sort}
                  onSort={sortBy}
                  onRun={(policy) => onAction({ kind: "run", policy })}
                  onEdit={(policy) =>
                    onAction({ kind: "edit", policy, ...editorContext })
                  }
                  onDelete={(policy) => onAction({ kind: "delete", policy })}
                />
              </div>
              {listPagination}
            </div>
          </section>
        ) : null}
        {policies && executions && tab === "executions" ? (
          <section className="replication-executions-section">
            <SectionHeading
              title="执行记录"
              total={sortedExecutions.length}
              zhUnit="条"
              enUnit="entries"
            />
            <div className="table-shell">
              <ReplicationExecutionFilter
                key={`${executionFilters.policy_id}-${executionFilters.status}-${executionFilters.trigger}`}
                policies={policies}
                values={executionFilters}
                onApply={filterExecutions}
              />
              <div className="table-scroll">
                <ReplicationExecutionTable
                  executions={sortedExecutions.slice(pageStart, pageEnd)}
                  policies={policies}
                  sort={sort}
                  onSort={sortBy}
                  onOpen={(execution, policy) =>
                    onAction({ kind: "execution", execution, policy })
                  }
                />
              </div>
              {listPagination}
            </div>
          </section>
        ) : null}
      </ContentTransition>
    </>
  );
}
