import type { ConsoleRoute } from "../../app/console-route";
import { useLocale } from "../../app/locale-context";
import type {
  ProjectLabel,
  Registry,
  ReplicationAdapterInfo,
  ReplicationExecution,
  ReplicationPolicy,
} from "../../app/models";
import { ContentTransition } from "../../components/content-transition";
import { DemoBanner } from "../../components/demo-banner";
import { ErrorView } from "../../components/error-view";
import { Icon } from "../../components/icon";
import { PageHeader } from "../../components/page-header";
import { Pagination } from "../../components/pagination";
import { RefreshButton } from "../../components/refresh-button";
import { SectionHeading } from "../../components/section-heading";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { ReplicationExecutionFilter } from "./replication-execution-filter";
import { ReplicationExecutionTable } from "./replication-execution-table";
import { ReplicationPolicyFilter } from "./replication-policy-filter";
import { ReplicationPolicyTable } from "./replication-policy-table";
import {
  type ExecutionFilterValues,
  pageSizeOptions,
  parseReplicationRoute,
  replicationPath,
  sortQueryValue,
} from "./replication-routing";
import { sortExecutions, sortPolicies } from "./replication-sorting";
import styles from "./replication.module.css";
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
    <section className={resolveClasses("table-shell")}>
      <div className={resolveClasses("loading-state")}>
        <div>
          <span className={resolveClasses("spinner")} />
        </div>
      </div>
    </section>
  );
}

type ReplicationPageProps = {
  route: ConsoleRoute;
  demo: boolean;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => void;
  onAction: (action: ReplicationAction) => void;
};

export function ReplicationPage({
  route,
  demo,
  refreshing,
  navigate,
  onRefresh,
  onAction,
}: ReplicationPageProps) {
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

  const sortedPolicies = (() => sortPolicies(policies ?? [], sort, locale))();
  const sortedExecutions = (() =>
    sortExecutions({
      executions: executions ?? [],
      policies: policies ?? [],
      sort: sort,
      locale: locale,
    }))();
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
  const showPage = (nextPage: number, nextPageSize = pageSize) => {
    navigate(
      replicationPath({
        tab: tab,
        page: nextPage,
        pageSize: nextPageSize,
        values: listQuery(),
      }),
    );
  };
  const sortBy = (nextSort: string) => {
    navigate(
      replicationPath({
        tab: tab,
        page: 1,
        pageSize: pageSize,
        values: listQuery(nextSort),
      }),
    );
  };
  const filterPolicies = (query: string) => {
    navigate(
      replicationPath({
        tab: "policies",
        page: 1,
        pageSize: pageSize,
        values: {
          q: query,
          sort: sortQueryValue("policies", sort),
        },
      }),
    );
  };
  const filterExecutions = (filters: ExecutionFilterValues) => {
    navigate(
      replicationPath({
        tab: "executions",
        page: 1,
        pageSize: pageSize,
        values: {
          ...filters,
          sort: sortQueryValue("executions", sort),
        },
      }),
    );
  };

  const listPagination = (
    <Pagination
      pagination={{ page, page_size: pageSize, total }}
      onPageChange={(nextPage) => {
        showPage(nextPage);
      }}
      pageSizeOptions={pageSizeOptions}
      onPageSizeChange={(nextPageSize) => {
        showPage(1, nextPageSize);
      }}
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
              className={resolveClasses("button button-small button-primary")}
              type="button"
              onClick={() => {
                onAction({ kind: "create", ...editorContext });
              }}
            >
              <Icon name="plus" />
              <span>{t("新建策略")}</span>
            </button>
          </>
        }
      />
      {demo ? <DemoBanner /> : null}
      <nav
        className={resolveClasses("resource-tabs replication-list-tabs")}
        aria-label={t("复制管理页面")}
      >
        <a
          href="#/replication"
          className={resolveClasses(tab === "policies" ? "active" : "")}
          aria-current={tab === "policies" ? "page" : undefined}
        >
          <Icon name="settings" />
          <span>{t("复制策略")}</span>
        </a>
        <a
          href="#/replication?tab=executions"
          className={resolveClasses(tab === "executions" ? "active" : "")}
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
          <section
            className={resolveClasses(styles.replicationPoliciesSection)}
          >
            <SectionHeading
              title="复制策略"
              total={sortedPolicies.length}
              zhUnit="条"
              enUnit="entries"
            />
            <div className={resolveClasses("table-shell")}>
              <ReplicationPolicyFilter
                query={policyFilter}
                onSearch={filterPolicies}
              />
              <div className={resolveClasses("table-scroll")}>
                <ReplicationPolicyTable
                  policies={sortedPolicies.slice(pageStart, pageEnd)}
                  sort={sort}
                  onSort={sortBy}
                  onRun={(policy) => {
                    onAction({ kind: "run", policy });
                  }}
                  onEdit={(policy) => {
                    onAction({ kind: "edit", policy, ...editorContext });
                  }}
                  onDelete={(policy) => {
                    onAction({ kind: "delete", policy });
                  }}
                />
              </div>
              {listPagination}
            </div>
          </section>
        ) : null}
        {policies && executions && tab === "executions" ? (
          <section className={resolveClasses("replication-executions-section")}>
            <SectionHeading
              title="执行记录"
              total={sortedExecutions.length}
              zhUnit="条"
              enUnit="entries"
            />
            <div className={resolveClasses("table-shell")}>
              <ReplicationExecutionFilter
                key={`${executionFilters.policy_id}-${executionFilters.status}-${executionFilters.trigger}`}
                policies={policies}
                values={executionFilters}
                onApply={filterExecutions}
              />
              <div className={resolveClasses("table-scroll")}>
                <ReplicationExecutionTable
                  executions={sortedExecutions.slice(pageStart, pageEnd)}
                  policies={policies}
                  sort={sort}
                  onSort={sortBy}
                  onOpen={(execution, policy) => {
                    onAction({ kind: "execution", execution, policy });
                  }}
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

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "page-header": uiStyles0.pageHeader,
  "refresh-button": uiStyles0.refreshButton,
  "section-heading": uiStyles0.sectionHeading,
  "table-shell": uiStyles0.tableShell,
  "loading-state": uiStyles0.loadingState,
  spinner: uiStyles0.spinner,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  "resource-tabs": uiStyles0.resourceTabs,
  active: uiStyles0.active,
  "table-scroll": uiStyles0.tableScroll,
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
