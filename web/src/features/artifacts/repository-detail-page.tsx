import { useCallback, useMemo, useState } from "react";

import { formatDate, formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type { Locale, RepositorySummary, Session } from "../../app/models";
import { Pagination } from "../../components/data-table";
import { ErrorView } from "../../components/feedback";
import { Icon } from "../../components/icons";
import {
  Breadcrumb,
  DemoBanner,
  PageHeader,
  RefreshButton,
  StatCell,
} from "../../components/page-elements";
import { repositoryDisplayName } from "./artifact-utils";
import { ArtifactTable } from "./repository-artifact-table";
import {
  ArtifactBatchToolbar,
  type ArtifactBatchWorker,
  ArtifactFilterForm,
} from "./repository-artifact-toolbars";
import {
  parseRepositoryRoute,
  type RepositoryArtifactAction,
  type RepositoryRouteState,
  repositoryPath,
  useRepositoryData,
} from "./repository-artifacts-data";

export type { RepositoryArtifactAction } from "./repository-artifacts-data";

function RepositoryStats({
  repository,
  project,
  artifactTotal,
}: {
  repository: RepositorySummary;
  project: string;
  artifactTotal: number;
}) {
  const { locale, t } = useLocale();
  return (
    <section
      className="overview-stats project-stats"
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
        value={formatDate(repository.update_time, locale, false)}
        foot={formatDate(repository.update_time, locale)}
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
}: {
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
}) {
  const { locale, t } = useLocale();
  const routeKey = `${route.path}?${route.query.toString()}`;
  // The path and query capture every route field, so parsing reruns only on navigation.
  const routeState = useMemo(() => parseRepositoryRoute(route), [routeKey]);
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
  const selectedArtifacts = useMemo(
    () => artifacts.filter((artifact) => selected.has(artifact.digest)),
    [artifacts, selected],
  );

  const updateRoute = (updates: Partial<RepositoryRouteState>) =>
    navigate(repositoryPath(routeState, updates));

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

  const toggleArtifact = (digest: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(digest)) next.delete(digest);
      else next.add(digest);
      return next;
    });

  const togglePage = () =>
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
        <section className="table-shell">
          <div className="loading-state">
            <div>
              <span className="spinner" />
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
              className="button button-small"
              type="button"
              onClick={() =>
                onShowPushCommand(routeState.project, repository.name)
              }
            >
              <Icon name="upload" />
              <span>{t("推送指引")}</span>
            </button>
            <button
              className="button button-small"
              type="button"
              onClick={() => onEditRepository(routeState.project, repository)}
            >
              <Icon name="edit" />
              <span>{t("编辑仓库")}</span>
            </button>
            <button
              className="button button-small button-danger"
              type="button"
              onClick={() => onDeleteRepository(routeState.project, repository)}
            >
              <Icon name="trash" />
              <span>{t("删除")}</span>
            </button>
          </>
        }
      />
      {session.demo ? <DemoBanner /> : null}
      <RepositoryStats
        repository={repository}
        project={routeState.project}
        artifactTotal={data.artifacts.pagination.total}
      />
      <section className="table-shell">
        <ArtifactFilterForm
          filters={routeState}
          labels={data.labels}
          onApply={(filters) => updateRoute({ page: 1, ...filters })}
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
        <div className="table-scroll">
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
          onPageChange={(page) => updateRoute({ page })}
        />
      </section>
    </>
  );
}
