import { useState } from "react";
import type { ConsoleRoute } from "../../app/console-route";
import { useLocale } from "../../app/locale-context";
import type { ProjectSummary, Session } from "../../app/models";
import { loadPreferences, savePreferences } from "../../app/preferences";
import { ContentTransition } from "../../components/content-transition";
import { DemoBanner } from "../../components/demo-banner";
import { EmptyState } from "../../components/empty-state";
import { ErrorView } from "../../components/error-view";
import { Icon } from "../../components/icon";
import { PageHeader } from "../../components/page-header";
import { Pagination } from "../../components/pagination";
import { RefreshButton } from "../../components/refresh-button";
import { SectionHeading } from "../../components/section-heading";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatNumber } from "../../lib/format/formatters";
import { RepositoryAssetCards } from "./repository-asset-cards";
import {
  artifactListPath,
  pageSizeOptions,
  parseRepositoryAssetRoute,
  repositoryAssetPath,
  useRepositoryAssetPage,
  useRepositoryAssets,
  type RepositoryAsset,
  type RepositoryAssetRoute,
} from "./repository-asset-data";
import { RepositoryAssetStats } from "./repository-asset-stats";
import { RepositoryAssetTable } from "./repository-asset-table";
import { RepositoryAssetToolbar } from "./repository-asset-toolbar";
import uiStyles1 from "./shared-ui.module.css";

/** Stable fallback so the filtered page is not recomputed on every render. */
const emptyRepositories: RepositoryAsset[] = [];

type RepositoriesPageProps = {
  route: ConsoleRoute;
  session: Session;
  projects: ProjectSummary[];
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => Promise<void>;
  onShowPushCommand: (project: string, repository?: string) => void;
};

export function RepositoriesPage({
  route,
  session,
  projects,
  refreshing,
  navigate,
  onRefresh,
  onShowPushCommand,
}: RepositoriesPageProps) {
  const { locale, t } = useLocale();
  // The path and query capture every route field, so parsing reruns only on navigation.
  const routeState = (() => parseRepositoryAssetRoute(route))();
  const { data, loading, error, reload } = useRepositoryAssets(projects);
  const { visible, pagination } = useRepositoryAssetPage(
    data?.repositories ?? emptyRepositories,
    routeState,
    locale,
  );
  const [preferences, setPreferences] = useState(loadPreferences);
  const initialLoading = loading && !data;

  const updateRoute = (updates: Partial<RepositoryAssetRoute>) => {
    navigate(repositoryAssetPath(routeState, updates));
  };

  function setViewMode(mode: "card" | "list") {
    const next = { ...preferences, repositoryView: mode };
    setPreferences(next);
    savePreferences(next);
  }

  function renderRepositories() {
    if (initialLoading) {
      return (
        <div className={resolveClasses("route-loading")} role="status">
          <span className={resolveClasses("spinner spinner-small")} />
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
    const open = (repository: RepositoryAsset) => {
      navigate(artifactListPath(repository));
    };
    return preferences.repositoryView === "card" ? (
      <RepositoryAssetCards
        repositories={visible}
        onOpen={open}
        onShowPushCommand={(repository) => {
          onShowPushCommand(repository.project_name, repository.name);
        }}
      />
    ) : (
      <RepositoryAssetTable
        repositories={visible}
        sort={routeState.sort}
        onSort={(sort) => {
          updateRoute({ page: 1, sort });
        }}
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
        <div className={resolveClasses("notice notice-warning")}>
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
      <section className={resolveClasses("table-shell")}>
        <RepositoryAssetToolbar
          query={routeState.query}
          project={routeState.project}
          projects={projects}
          viewMode={preferences.repositoryView}
          onSearch={(query) => {
            updateRoute({ page: 1, query });
          }}
          onProjectChange={(project) => {
            updateRoute({ page: 1, project });
          }}
          onClear={() => {
            updateRoute({ page: 1, query: "", project: "" });
          }}
          onViewModeChange={setViewMode}
        />
        <ContentTransition mode={preferences.repositoryView}>
          {renderRepositories()}
          {!loading && !error ? (
            <Pagination
              pagination={pagination}
              onPageChange={(page) => {
                updateRoute({ page });
              }}
              pageSizeOptions={pageSizeOptions}
              onPageSizeChange={(pageSize) => {
                updateRoute({ page: 1, pageSize });
              }}
            />
          ) : null}
        </ContentTransition>
      </section>
    </>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "page-header": uiStyles0.pageHeader,
  "refresh-button": uiStyles0.refreshButton,
  "section-heading": uiStyles0.sectionHeading,
  "route-loading": uiStyles0.routeLoading,
  spinner: uiStyles0.spinner,
  "spinner-small": uiStyles0.spinnerSmall,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  "table-shell": uiStyles0.tableShell,
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
  "repository-asset-stats": uiStyles1.repositoryAssetStats,
  "repository-asset-table": uiStyles1.repositoryAssetTable,
  "repository-asset-toolbar": uiStyles1.repositoryAssetToolbar,
});
