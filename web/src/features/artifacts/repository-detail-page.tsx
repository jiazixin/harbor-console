import { useCallback, useMemo, useState } from "react";
import type { ConsoleRoute } from "../../app/console-route";
import { useLocale } from "../../app/locale-context";
import type { Locale, RepositorySummary, Session } from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { Breadcrumb } from "../../components/breadcrumb";
import { DemoBanner } from "../../components/demo-banner";
import { ErrorView } from "../../components/error-view";
import { Icon } from "../../components/icon";
import { PageHeader } from "../../components/page-header";
import { Pagination } from "../../components/pagination";
import { RefreshButton } from "../../components/refresh-button";
import uiStyles0 from "../../components/shared-ui.module.css";
import { StatCell } from "../../components/stat-cell";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, formatNumber } from "../../lib/format/formatters";
import { ArtifactBatchToolbar } from "./artifact-batch-toolbar";
import { ArtifactFilterForm } from "./artifact-filter-form";
import { repositoryDisplayName } from "./artifact-utils";
import { ArtifactTable } from "./repository-artifact-table";
import { type ArtifactBatchWorker } from "./repository-artifact-toolbars-support";
import {
  parseRepositoryRoute,
  repositoryPath,
  useRepositoryData,
  type RepositoryArtifactAction,
  type RepositoryRouteState,
} from "./repository-artifacts-data";

export type { RepositoryArtifactAction } from "./repository-artifacts-data";

type RepositoryStatsProps = {
  repository: RepositorySummary;
  project: string;
  artifactTotal: number;
};

function RepositoryStats({
  repository,
  project,
  artifactTotal,
}: RepositoryStatsProps) {
  const { locale, t } = useLocale();
  return (
    <section
      className={resolveClasses("overview-stats project-stats")}
      aria-label={t("仓库统计")}
    >
      <StatCell
        label={t("制品")}
        value={formatNumber(repository.artifact_count ?? artifactTotal, locale)}
        foot={t("当前仓库")}
        icon="package"
      />
      <StatCell
        label={t("拉取次数")}
        value={formatNumber(repository.pull_count, locale)}
        foot={t("累计拉取")}
        icon="download"
      />
      <StatCell
        label={t("最近更新")}
        value={formatDate(repository.update_time, {
          locale: locale,
          timeZone: displayTimeZone(),
          includeTime: false,
        })}
        foot={formatDate(repository.update_time, {
          locale: locale,
          timeZone: displayTimeZone(),
        })}
        icon="refresh"
      />
      <StatCell
        label={t("仓库编号")}
        value={`#${String(repository.id ?? "-")}`}
        foot={project}
        icon="database"
      />
    </section>
  );
}

function repositorySubtitle(repository: RepositorySummary, locale: Locale) {
  if (repository.description?.trim()) return repository.description;
  const artifacts = formatNumber(repository.artifact_count, locale);
  const pulls = formatNumber(repository.pull_count, locale);
  return locale === "en-US"
    ? `${artifacts} artifacts · ${pulls} pulls`
    : `${artifacts} 个制品 · ${pulls} 次拉取`;
}

type RepositoryDetailPageProps = {
  route: ConsoleRoute;
  session: Session;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => Promise<void>;
  onShowPushCommand: (project: string, repository: string) => void;
  onEditRepository: (project: string, repository: RepositorySummary) => void;
  onDeleteRepository: (project: string, repository: RepositorySummary) => void;
  onArtifactAction: (action: RepositoryArtifactAction) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function RepositoryDetailPage({
  route,
  session,
  refreshing,
  navigate,
  onRefresh,
  onShowPushCommand,
  onEditRepository,
  onDeleteRepository,
  onArtifactAction,
  onNotice,
}: RepositoryDetailPageProps) {
  const { locale, t } = useLocale();
  const routeKey = `${route.path}?${route.query.toString()}`;
  // The path and query capture every route field, so parsing reruns only on navigation.
  const routeState = (() => parseRepositoryRoute(route))();
  const { data, loading, error, reload } = useRepositoryData(routeState);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [batchBusy, setBatchBusy] = useState(false);

  // Another page or filter starts without a selection.
  const [selectionRouteKey, setSelectionRouteKey] = useState(routeKey);
  if (selectionRouteKey !== routeKey) {
    setSelectionRouteKey(routeKey);
    setSelected(new Set());
  }

  const refreshPage = useCallback(async () => {
    await onRefresh();
    reload();
  }, [onRefresh, reload]);

  const artifacts = useMemo(
    () => data?.artifacts.items ?? [],
    [data?.artifacts.items],
  );
  const selectedArtifacts = (() =>
    artifacts.filter((artifact) => selected.has(artifact.digest)))();

  const updateRoute = (updates: Partial<RepositoryRouteState>) => {
    navigate(repositoryPath(routeState, updates));
  };

  async function runBatch(title: string, worker: ArtifactBatchWorker) {
    if (!selectedArtifacts.length) return;
    setBatchBusy(true);
    const results = await Promise.allSettled(selectedArtifacts.map(worker));
    const failures = results.filter(
      (result) => result.status === "rejected",
    ).length;
    setBatchBusy(false);
    setSelected(new Set());
    onNotice(
      failures
        ? `${title}完成，${String(failures)} 项失败`
        : `${title}已提交，共 ${formatNumber(selectedArtifacts.length, locale)} 个制品`,
      failures > 0,
    );
    reload();
  }

  const toggleArtifact = (digest: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(digest)) next.delete(digest);
      else next.add(digest);
      return next;
    });
  };

  const togglePage = () => {
    setSelected((current) => {
      const next = new Set(current);
      const allSelected = artifacts.every((artifact) =>
        next.has(artifact.digest),
      );
      for (const artifact of artifacts) {
        if (allSelected) next.delete(artifact.digest);
        else next.add(artifact.digest);
      }
      return next;
    });
  };

  const displayName = repositoryDisplayName(
    routeState.project,
    data?.repository.name ?? routeState.repository,
  );
  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "项目中心", href: "#/projects" },
        {
          label: routeState.project,
          href: `#/projects/${encodeURIComponent(routeState.project)}/repositories`,
        },
        { label: displayName },
      ]}
    />
  );

  if (loading && !data) {
    return (
      <>
        <PageHeader
          title={displayName}
          subtitle={t("正在读取仓库制品")}
          breadcrumb={breadcrumb}
          actions={<RefreshButton refreshing onRefresh={() => undefined} />}
        />
        {session.demo ? <DemoBanner /> : null}
        <section className={resolveClasses("table-shell")}>
          <div className={resolveClasses("loading-state")}>
            <div>
              <span className={resolveClasses("spinner")} />
            </div>
          </div>
        </section>
      </>
    );
  }

  if (error || !data) {
    return (
      <ErrorView
        title="仓库详情载入失败"
        message={error || t("仓库不存在")}
        retry={reload}
      />
    );
  }

  const repository = data.repository;

  return (
    <>
      <PageHeader
        title={displayName}
        subtitle={repositorySubtitle(repository, locale)}
        breadcrumb={breadcrumb}
        actions={
          <>
            <RefreshButton
              refreshing={refreshing || loading}
              onRefresh={() => void refreshPage()}
            />
            <button
              className={resolveClasses("button button-small")}
              type="button"
              onClick={() => {
                onShowPushCommand(routeState.project, repository.name);
              }}
            >
              <Icon name="upload" />
              <span>{t("推送指引")}</span>
            </button>
            <button
              className={resolveClasses("button button-small")}
              type="button"
              onClick={() => {
                onEditRepository(routeState.project, repository);
              }}
            >
              <Icon name="edit" />
              <span>{t("编辑仓库")}</span>
            </button>
            <button
              className={resolveClasses("button button-small button-danger")}
              type="button"
              onClick={() => {
                onDeleteRepository(routeState.project, repository);
              }}
            >
              <Icon name="trash" />
              <span>{t("删除")}</span>
            </button>
          </>
        }
      />
      {session.demo ? <DemoBanner /> : null}
      {data.labelErrors.length ? (
        <ErrorView message={data.labelErrors.join(" · ")} retry={reload} />
      ) : null}
      <RepositoryStats
        repository={repository}
        project={routeState.project}
        artifactTotal={data.artifacts.pagination.total}
      />
      <section className={resolveClasses("table-shell")}>
        <ArtifactFilterForm
          filters={routeState}
          labels={data.labels}
          onApply={(filters) => {
            updateRoute({ page: 1, ...filters });
          }}
        />
        <ArtifactBatchToolbar
          project={routeState.project}
          repository={routeState.repository}
          selectedArtifacts={selectedArtifacts}
          labels={data.labels}
          busy={batchBusy}
          onRunBatch={(title, worker) => void runBatch(title, worker)}
          onArtifactAction={onArtifactAction}
        />
        <div className={resolveClasses("table-scroll")}>
          <ArtifactTable
            artifacts={artifacts}
            project={routeState.project}
            repository={repository.name}
            selected={selected}
            busy={batchBusy}
            navigate={navigate}
            onToggle={toggleArtifact}
            onToggleAll={togglePage}
          />
        </div>
        <Pagination
          pagination={data.artifacts.pagination}
          onPageChange={(page) => {
            updateRoute({ page });
          }}
        />
      </section>
    </>
  );
}

const resolveClasses = createClassNames({
  breadcrumb: uiStyles0.breadcrumb,
  icon: uiStyles0.icon,
  "page-header": uiStyles0.pageHeader,
  "refresh-button": uiStyles0.refreshButton,
  "stat-cell": uiStyles0.statCell,
  "artifact-batch-toolbar": uiStyles0.artifactBatchToolbar,
  "overview-stats": uiStyles0.overviewStats,
  "table-shell": uiStyles0.tableShell,
  "loading-state": uiStyles0.loadingState,
  spinner: uiStyles0.spinner,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-danger": uiStyles0.buttonDanger,
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
