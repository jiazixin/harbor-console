import { useMemo, useState } from "react";

import { formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type { ProjectSummary, Session } from "../../app/models";
import { Pagination } from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { ErrorView } from "../../components/feedback";
import { Icon } from "../../components/icons";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
} from "../../components/page-elements";
import {
  pageSizeOptions,
  parseProjectRoute,
  projectNumber,
  projectPath,
  type ProjectRouteState,
  useProjectList,
} from "./project-list-data";
import {
  ProjectFilterForm,
  ProjectOverviewStats,
  ProjectTable,
} from "./project-list-views";

export function ProjectsPage({
  route,
  session,
  refreshing,
  navigate,
  onRefresh,
  onCreateProject,
  onDeleteProjects,
  onExportProjectCve,
}: {
  route: ConsoleRoute;
  session: Session;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => Promise<void>;
  onCreateProject: () => void;
  onDeleteProjects: (projects: ProjectSummary[]) => void;
  onExportProjectCve: (project: ProjectSummary) => void;
}) {
  const { locale, t } = useLocale();
  const routeKey = route.query.toString();
  // The query string captures every route field, so parsing reruns only on navigation.
  const routeState = useMemo(() => parseProjectRoute(route), [routeKey]);
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
  const updateRoute = (updates: Partial<ProjectRouteState>) =>
    navigate(projectPath({ ...routeState, ...updates }));
  const selectProject = (project: ProjectSummary, selected: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      const id = projectNumber(project.project_id);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });

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
              className="button button-small button-primary"
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
        <div className="notice notice-warning" role="status">
          <Icon name="alert" />
          <span>
            {t("项目概览统计载入失败")}：{list.overviewError}
          </span>
        </div>
      ) : null}
      <section className="table-shell">
        <ProjectFilterForm
          filters={routeState}
          onApply={(filters) => updateRoute({ page: 1, ...filters })}
        />
        <div className="artifact-batch-toolbar project-batch-toolbar">
          <span>
            <strong>{formatNumber(selectedProjects.length, locale)}</strong>{" "}
            {t("个已选择")}
          </span>
          <div>
            <button
              className="button button-small"
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
              className="button button-small button-danger"
              type="button"
              disabled={!selectedProjects.length}
              onClick={() => onDeleteProjects(selectedProjects)}
            >
              <Icon name="trash" />
              <span>{t("删除项目")}</span>
            </button>
          </div>
        </div>
        <div aria-busy={list.tableLoading}>
          {list.tableLoading && !list.table ? (
            <div
              className="route-loading"
              role="status"
              aria-label={t("正在载入")}
            >
              <span className="spinner spinner-small" aria-hidden="true" />
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
              onSort={(sort) => updateRoute({ page: 1, sort })}
              onSelect={selectProject}
              onSelectAll={(selected) =>
                setSelectedIds(
                  selected
                    ? new Set(
                        projects.map((project) =>
                          projectNumber(project.project_id),
                        ),
                      )
                    : new Set(),
                )
              }
              onOpen={(project) =>
                navigate(`projects/${encodeURIComponent(project.name)}`)
              }
            />
          ) : null}
        </div>
        {!list.tableError && list.table ? (
          <Pagination
            pagination={list.table.pagination}
            onPageChange={(page) => updateRoute({ page })}
            pageSizeOptions={pageSizeOptions}
            onPageSizeChange={(pageSize) => updateRoute({ page: 1, pageSize })}
          />
        ) : null}
      </section>
    </>
  );
}
