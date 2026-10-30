import { useState } from "react";
import type { ConsoleRoute } from "../../app/console-route";
import { useLocale } from "../../app/locale-context";
import type { ProjectSummary, Session } from "../../app/models";
import { DemoBanner } from "../../components/demo-banner";
import { EmptyState } from "../../components/empty-state";
import { ErrorView } from "../../components/error-view";
import { Icon } from "../../components/icon";
import { PageHeader } from "../../components/page-header";
import { Pagination } from "../../components/pagination";
import { RefreshButton } from "../../components/refresh-button";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatNumber } from "../../lib/format/formatters";
import { ProjectFilterForm } from "./project-filter-form";
import {
  pageSizeOptions,
  parseProjectRoute,
  projectNumber,
  projectPath,
  type ProjectRouteState,
  useProjectList,
} from "./project-list-data";
import { ProjectOverviewStats } from "./project-overview-stats";
import { ProjectTable } from "./project-table";
import uiStyles1 from "./projects-page.module.css";

type ProjectsPageProps = {
  route: ConsoleRoute;
  session: Session;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => Promise<void>;
  onCreateProject: () => void;
  onDeleteProjects: (projects: ProjectSummary[]) => void;
  onExportProjectCve: (project: ProjectSummary) => void;
};

export function ProjectsPage({
  route,
  session,
  refreshing,
  navigate,
  onRefresh,
  onCreateProject,
  onDeleteProjects,
  onExportProjectCve,
}: ProjectsPageProps) {
  const { locale, t } = useLocale();
  const routeKey = route.query.toString();
  // The query string captures every route field, so parsing reruns only on navigation.
  const routeState = (() => parseProjectRoute(route))();
  const list = useProjectList(routeState, locale);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const [selectionRouteKey, setSelectionRouteKey] = useState(routeKey);
  if (selectionRouteKey !== routeKey) {
    setSelectionRouteKey(routeKey);
    setSelectedIds(new Set());
  }

  const projects = list.table?.items ?? [];
  const selectedProjects = projects.filter((project) =>
    selectedIds.has(projectNumber(project.project_id)),
  );
  const updateRoute = (updates: Partial<ProjectRouteState>) => {
    navigate(projectPath({ ...routeState, ...updates }));
  };
  const selectProject = (project: ProjectSummary, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const id = projectNumber(project.project_id);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <>
      <PageHeader
        title="项目中心"
        subtitle={t("管理 Harbor 中的项目边界与访问策略")}
        actions={
          <>
            <RefreshButton
              refreshing={refreshing || list.tableLoading}
              onRefresh={() => {
                void onRefresh().then(list.reload);
              }}
            />
            <button
              className={resolveClasses("button button-small button-primary")}
              type="button"
              onClick={onCreateProject}
            >
              <Icon name="plus" />
              <span>{t("新建项目")}</span>
            </button>
          </>
        }
      />
      {session.demo ? <DemoBanner /> : null}
      <ProjectOverviewStats
        projects={list.visibleProjects}
        error={list.overviewError}
      />
      {list.overviewError ? (
        <div className={resolveClasses("notice notice-warning")} role="status">
          <Icon name="alert" />
          <span>
            {t("项目概览统计载入失败")}：{list.overviewError}
          </span>
        </div>
      ) : null}
      <section className={resolveClasses("table-shell")}>
        <ProjectFilterForm
          filters={routeState}
          onApply={(filters) => {
            updateRoute({ page: 1, ...filters });
          }}
        />
        <div
          className={resolveClasses(
            "artifact-batch-toolbar project-batch-toolbar",
          )}
        >
          <span>
            <strong>{formatNumber(selectedProjects.length, locale)}</strong>{" "}
            {t("个已选择")}
          </span>
          <div>
            <button
              className={resolveClasses("button button-small")}
              type="button"
              disabled={selectedProjects.length !== 1}
              onClick={() => {
                if (selectedProjects[0])
                  onExportProjectCve(selectedProjects[0]);
              }}
            >
              <Icon name="download" />
              <span>{t("导出 CVE")}</span>
            </button>
            <button
              className={resolveClasses("button button-small button-danger")}
              type="button"
              disabled={!selectedProjects.length}
              onClick={() => {
                onDeleteProjects(selectedProjects);
              }}
            >
              <Icon name="trash" />
              <span>{t("删除项目")}</span>
            </button>
          </div>
        </div>
        <div aria-busy={list.tableLoading}>
          {list.tableLoading && !list.table ? (
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
          ) : null}
          {list.tableError ? (
            <ErrorView
              title="项目载入失败"
              message={list.tableError}
              retry={list.reload}
            />
          ) : null}
          {!list.tableError && list.table && !projects.length ? (
            <EmptyState
              title="没有项目"
              description="当前筛选条件下没有项目。"
              icon="folder"
            />
          ) : null}
          {!list.tableError && projects.length ? (
            <ProjectTable
              projects={projects}
              selectedIds={selectedIds}
              sort={routeState.sort}
              onSort={(sort) => {
                updateRoute({ page: 1, sort });
              }}
              onSelect={selectProject}
              onSelectAll={(selected) => {
                setSelectedIds(
                  selected
                    ? new Set(
                        projects.map((project) =>
                          projectNumber(project.project_id),
                        ),
                      )
                    : new Set(),
                );
              }}
              onOpen={(project) => {
                navigate(`projects/${encodeURIComponent(project.name)}`);
              }}
            />
          ) : null}
        </div>
        {!list.tableError && list.table ? (
          <Pagination
            pagination={list.table.pagination}
            onPageChange={(page) => {
              updateRoute({ page });
            }}
            pageSizeOptions={pageSizeOptions}
            onPageSizeChange={(pageSize) => {
              updateRoute({ page: 1, pageSize });
            }}
          />
        ) : null}
      </section>
    </>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "page-header": uiStyles0.pageHeader,
  "refresh-button": uiStyles0.refreshButton,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  "table-shell": uiStyles0.tableShell,
  "artifact-batch-toolbar": uiStyles0.artifactBatchToolbar,
  "button-danger": uiStyles0.buttonDanger,
  "route-loading": uiStyles0.routeLoading,
  spinner: uiStyles0.spinner,
  "spinner-small": uiStyles0.spinnerSmall,
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
  "project-batch-toolbar": uiStyles1.projectBatchToolbar,
});
