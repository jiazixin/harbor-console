import { useMemo, useState } from "react";

import { formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type { ProjectSummary, Session } from "../../app/models";
import { loadPreferences, savePreferences } from "../../app/preferences";
import { ContentTransition } from "../../components/content-transition";
import { Pagination } from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { ErrorView } from "../../components/feedback";
import { Icon } from "../../components/icons";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
  SectionHeading,
} from "../../components/page-elements";
import {
  artifactListPath,
  pageSizeOptions,
  parseRepositoryAssetRoute,
  type RepositoryAsset,
  type RepositoryAssetRoute,
  repositoryAssetPath,
  useRepositoryAssetPage,
  useRepositoryAssets,
} from "./repository-asset-data";
import {
  RepositoryAssetCards,
  RepositoryAssetStats,
  RepositoryAssetTable,
  RepositoryAssetToolbar,
} from "./repository-asset-views";

/** Stable fallback so the filtered page is not recomputed on every render. */
const emptyRepositories: RepositoryAsset[] = [];

export function RepositoriesPage({
  route,
  session,
  projects,
  refreshing,
  navigate,
  onRefresh,
  onShowPushCommand,
}: {
  route: ConsoleRoute;
  session: Session;
  projects: ProjectSummary[];
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => Promise<void>;
  onShowPushCommand: (project: string, repository?: string) => void;
}) {
  const { locale, t } = useLocale();
  const routeKey = `${route.path}?${route.query.toString()}`;
  // The path and query capture every route field, so parsing reruns only on navigation.
  const routeState = useMemo(
    () => parseRepositoryAssetRoute(route),
    [routeKey],
  );
  const { data, loading, error, reload } = useRepositoryAssets(projects);
  const { visible, pagination } = useRepositoryAssetPage(
    data?.repositories ?? emptyRepositories,
    routeState,
    locale,
  );
  const [preferences, setPreferences] = useState(loadPreferences);
  const initialLoading = loading && !data;

  const updateRoute = (updates: Partial<RepositoryAssetRoute>) =>
    navigate(repositoryAssetPath(routeState, updates));

  function setViewMode(mode: "card" | "list") {
    const next = { ...preferences, repositoryView: mode };
    setPreferences(next);
    savePreferences(next);
  }

  function renderRepositories() {
    if (initialLoading) {
      return (
        <div className="route-loading" role="status">
          <span className="spinner spinner-small" />
        </div>
      );
    }
    if (error) {
      return (
        <ErrorView title="镜像仓库载入失败" message={error} retry={reload} />
      );
    }
    if (!visible.length) {
      return (
        <EmptyState
          title="没有匹配的镜像仓库"
          description="调整项目或搜索条件后重试。"
          icon="package"
        />
      );
    }
    const open = (repository: RepositoryAsset) =>
      navigate(artifactListPath(repository));
    return preferences.repositoryView === "card" ? (
      <RepositoryAssetCards
        repositories={visible}
        onOpen={open}
        onShowPushCommand={(repository) =>
          onShowPushCommand(repository.project_name, repository.name)
        }
      />
    ) : (
      <RepositoryAssetTable
        repositories={visible}
        sort={routeState.sort}
        onSort={(sort) => updateRoute({ page: 1, sort })}
        onOpen={open}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="镜像仓库"
        subtitle={t("跨项目浏览全部镜像仓库、制品规模与拉取活动")}
        actions={
          <RefreshButton
            refreshing={refreshing || loading}
            onRefresh={() => {
              void onRefresh().then(reload);
            }}
          />
        }
      />
      {session.demo ? <DemoBanner /> : null}
      {data?.failures.length ? (
        <div className="notice notice-warning">
          <Icon name="alert" />
          <span>
            <strong>
              {formatNumber(data.failures.length, locale)}{" "}
              {t("个项目读取失败。")}
            </strong>{" "}
            {t("其余项目资产仍可浏览。")}
          </span>
        </div>
      ) : null}
      <RepositoryAssetStats
        repositories={data?.repositories}
        projectCount={projects.length}
        loading={initialLoading}
        unavailable={Boolean(error) && !data}
      />
      <SectionHeading
        title="镜像仓库"
        total={data ? pagination.total : undefined}
        zhUnit="个"
        enUnit="repositories"
        loading={initialLoading}
        error={Boolean(error)}
      />
      <section className="table-shell">
        <RepositoryAssetToolbar
          query={routeState.query}
          project={routeState.project}
          projects={projects}
          viewMode={preferences.repositoryView}
          onSearch={(query) => updateRoute({ page: 1, query })}
          onProjectChange={(project) => updateRoute({ page: 1, project })}
          onClear={() => updateRoute({ page: 1, query: "", project: "" })}
          onViewModeChange={setViewMode}
        />
        <ContentTransition mode={preferences.repositoryView}>
          {renderRepositories()}
          {!loading && !error ? (
            <Pagination
              pagination={pagination}
              onPageChange={(page) => updateRoute({ page })}
              pageSizeOptions={pageSizeOptions}
              onPageSizeChange={(pageSize) =>
                updateRoute({ page: 1, pageSize })
              }
            />
          ) : null}
        </ContentTransition>
      </section>
    </>
  );
}
