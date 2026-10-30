import { type MouseEvent, useState } from "react";
import { useLocale } from "../../app/locale-context";
import type { ControlPagination, RepositorySummary } from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { EmptyState } from "../../components/empty-state";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import { Pagination } from "../../components/pagination";
import uiStyles0 from "../../components/shared-ui.module.css";
import { SortableHeader } from "../../components/sortable-header";
import { StableTableColumns } from "../../components/stable-table-columns";
import { ToolbarSearchForm } from "../../components/toolbar-search-form";
import { ViewModeToggle } from "../../components/view-mode-toggle";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, formatNumber } from "../../lib/format/formatters";
import uiStyles1 from "./project-repositories-section.module.css";

type ViewMode = "card" | "list";

function repositoryId(repository: RepositorySummary): number {
  return Number.isFinite(repository.id) ? Number(repository.id) : 0;
}

/** Repository names include the project prefix; the project page hides it. */
function nameWithinProject(project: string, repository: string): string {
  const prefix = `${project}/`;
  return repository.startsWith(prefix)
    ? repository.slice(prefix.length)
    : repository;
}

/** Clicks on the row itself open the repository; inner controls keep their own action. */
function isRowClick(event: MouseEvent<HTMLElement>): boolean {
  return !(event.target as HTMLElement).closest("input, button, a");
}

type SelectionCheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function SelectionCheckbox({
  label,
  checked,
  onChange,
}: SelectionCheckboxProps) {
  return (
    <FormInput
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => {
        onChange(event.currentTarget.checked);
      }}
    />
  );
}

type PushGuideButtonProps = { onClick: () => void };

function PushGuideButton({ onClick }: PushGuideButtonProps) {
  const { t } = useLocale();
  return (
    <button
      className={resolveClasses("icon-button")}
      type="button"
      title={t("推送指引")}
      aria-label={t("查看推送指引")}
      onClick={onClick}
    >
      <Icon name="upload" />
    </button>
  );
}

type RepositoryViewProps = {
  project: string;
  repositories: RepositorySummary[];
  selectedIds: ReadonlySet<number>;
  onSelect: (id: number, selected: boolean) => void;
  onOpen: (repository: RepositorySummary) => void;
  onShowPushCommand: (repository: RepositorySummary) => void;
};

function RepositoryCards({
  project,
  repositories,
  selectedIds,
  onSelect,
  onOpen,
  onShowPushCommand,
}: RepositoryViewProps) {
  const { locale, t } = useLocale();
  return (
    <div className={resolveClasses("repository-card-grid")}>
      {repositories.map((repository) => {
        const id = repositoryId(repository);
        const selected = selectedIds.has(id);
        const name = nameWithinProject(project, repository.name);
        return (
          <article
            key={id || repository.name}
            className={resolveClasses(
              `repository-card${selected ? " selected" : ""}`,
            )}
            onClick={(event) => {
              if (isRowClick(event)) onOpen(repository);
            }}
          >
            <header>
              <label className={resolveClasses("repository-card-select")}>
                <SelectionCheckbox
                  label={`${t("选择")} ${name}`}
                  checked={selected}
                  onChange={(checked) => {
                    onSelect(id, checked);
                  }}
                />
              </label>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    onOpen(repository);
                  }}
                >
                  {name}
                </button>
                <span className={resolveClasses("mono")}>
                  #{repository.id ?? "-"}
                </span>
              </div>
              <PushGuideButton
                onClick={() => {
                  onShowPushCommand(repository);
                }}
              />
            </header>
            <p>
              {repository.description?.trim()
                ? repository.description
                : t("暂无仓库描述")}
            </p>
            <dl>
              <div>
                <dt>{t("制品")}</dt>
                <dd>{formatNumber(repository.artifact_count, locale)}</dd>
              </div>
              <div>
                <dt>{t("累计拉取")}</dt>
                <dd>{formatNumber(repository.pull_count, locale)}</dd>
              </div>
              <div>
                <dt>{t("最近更新")}</dt>
                <dd>
                  {formatDate(repository.update_time, {
                    locale: locale,
                    timeZone: displayTimeZone(),
                  })}
                </dd>
              </div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

function RepositoryTable({
  project,
  repositories,
  selectedIds,
  sort,
  onSort,
  onSelect,
  onSelectAll,
  onOpen,
  onShowPushCommand,
}: RepositoryViewProps & {
  sort: string;
  onSort: (sort: string) => void;
  onSelectAll: (selected: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const allSelected = repositories.every((repository) =>
    selectedIds.has(repositoryId(repository)),
  );
  const header = ({
    label,
    field,
    className,
    descendingFirst = false,
  }: {
    label: string;
    field: string;
    className?: string;
    descendingFirst?: boolean;
  }) => (
    <SortableHeader
      label={label}
      field={field}
      className={resolveClasses(className)}
      descendingFirst={descendingFirst}
      currentSort={sort}
      onSort={onSort}
    />
  );
  return (
    <div className={resolveClasses("table-scroll")}>
      <table
        className={resolveClasses("repository-select-table data-table-stable")}
      >
        <StableTableColumns
          widths={["44px", "30%", "11%", "11%", "20%", "144px", "44px"]}
        />
        <thead>
          <tr>
            <th className={resolveClasses("selection-cell")}>
              <SelectionCheckbox
                label={t("选择当前页全部仓库")}
                checked={allSelected}
                onChange={onSelectAll}
              />
            </th>
            {header({ label: "仓库", field: "name" })}
            {header({
              label: "制品",
              field: "artifact_count",
              className: "table-cell-number repository-metric-count",
              descendingFirst: true,
            })}
            {header({
              label: "拉取次数",
              field: "pull_count",
              className: "table-cell-number repository-metric-count",
              descendingFirst: true,
            })}
            <th>{t("描述")}</th>
            {header({
              label: "最近更新",
              field: "update_time",
              className: "table-cell-time",
              descendingFirst: true,
            })}
            <th />
          </tr>
        </thead>
        <tbody>
          {repositories.map((repository) => {
            const id = repositoryId(repository);
            const selected = selectedIds.has(id);
            const name = nameWithinProject(project, repository.name);
            return (
              <tr
                key={id || repository.name}
                className={resolveClasses(
                  `clickable-row${selected ? " selected-row" : ""}`,
                )}
                onClick={(event) => {
                  if (isRowClick(event)) onOpen(repository);
                }}
              >
                <td className={resolveClasses("selection-cell")}>
                  <SelectionCheckbox
                    label={`${t("选择")} ${name}`}
                    checked={selected}
                    onChange={(checked) => {
                      onSelect(id, checked);
                    }}
                  />
                </td>
                <td>
                  <div className={resolveClasses("cell-title")}>
                    <span className={resolveClasses("cell-stack")}>
                      <strong>{name}</strong>
                      <small className={resolveClasses("mono")}>
                        #{repository.id ?? "-"}
                      </small>
                    </span>
                  </div>
                </td>
                <td
                  className={resolveClasses(
                    "mono table-cell-number repository-metric-count",
                  )}
                >
                  {formatNumber(repository.artifact_count, locale)}
                </td>
                <td
                  className={resolveClasses(
                    "mono table-cell-number repository-metric-count",
                  )}
                >
                  {formatNumber(repository.pull_count, locale)}
                </td>
                <td className={resolveClasses("truncate-cell")}>
                  {repository.description?.trim()
                    ? repository.description
                    : "-"}
                </td>
                <td className={resolveClasses("table-cell-time")}>
                  {formatDate(repository.update_time, {
                    locale: locale,
                    timeZone: displayTimeZone(),
                  })}
                </td>
                <td>
                  <div className={resolveClasses("row-actions")}>
                    <PushGuideButton
                      onClick={() => {
                        onShowPushCommand(repository);
                      }}
                    />
                    <Icon name="chevron" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The project's repository list with search, list/card views and batch deletion. */
type ProjectRepositoriesSectionProps = {
  project: string;
  repositories: RepositorySummary[];
  pagination: ControlPagination;
  query: string;
  sort: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSearch: (query: string) => void;
  onSort: (sort: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpen: (repository: RepositorySummary) => void;
  onShowPushCommand: (repository?: RepositorySummary) => void;
  onDeleteRepositories: (repositories: RepositorySummary[]) => void;
};

export function ProjectRepositoriesSection({
  project,
  repositories,
  pagination,
  query,
  sort,
  viewMode,
  onViewModeChange,
  onSearch,
  onSort,
  onPageChange,
  onPageSizeChange,
  onOpen,
  onShowPushCommand,
  onDeleteRepositories,
}: ProjectRepositoriesSectionProps) {
  const { locale, t } = useLocale();
  const [draftQuery, setDraftQuery] = useState(query);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(
    new Set(),
  );

  // A new page, sort or search starts with the route query and no selection.
  const routeKey = [
    project,
    query,
    sort,
    pagination.page,
    pagination.page_size,
  ].join("|");
  const [selectionRouteKey, setSelectionRouteKey] = useState(routeKey);
  if (selectionRouteKey !== routeKey) {
    setSelectionRouteKey(routeKey);
    setDraftQuery(query);
    setSelectedIds(new Set());
  }

  const selectedRepositories = (() =>
    repositories.filter((repository) =>
      selectedIds.has(repositoryId(repository)),
    ))();
  const select = (id: number, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const viewProps: RepositoryViewProps = {
    project,
    repositories,
    selectedIds,
    onSelect: select,
    onOpen,
    onShowPushCommand,
  };

  return (
    <section className={resolveClasses("table-shell")}>
      <div className={resolveClasses("table-toolbar")}>
        <ToolbarSearchForm
          name="q"
          placeholder="按仓库名称搜索"
          value={draftQuery}
          onChange={setDraftQuery}
          onSubmit={onSearch}
        />
        <button
          className={resolveClasses("button button-small button-primary")}
          type="button"
          onClick={() => {
            onShowPushCommand();
          }}
        >
          <Icon name="upload" />
          <span>{t("推送镜像")}</span>
        </button>
        <div className={resolveClasses("toolbar-spacer")} />
        <ViewModeToggle
          value={viewMode}
          ariaLabel={t("仓库展示方式")}
          listLabel={t("列表视图")}
          cardLabel={t("卡片视图")}
          onChange={onViewModeChange}
        />
      </div>
      <div
        className={resolveClasses(
          "artifact-batch-toolbar repository-batch-toolbar",
        )}
      >
        <span>
          <strong>{formatNumber(selectedRepositories.length, locale)}</strong>{" "}
          {t("个已选择")}
        </span>
        <div>
          <button
            className={resolveClasses("button button-small button-danger")}
            type="button"
            disabled={!selectedRepositories.length}
            onClick={() => {
              onDeleteRepositories(selectedRepositories);
            }}
          >
            <Icon name="trash" />
            <span>{t("删除仓库")}</span>
          </button>
        </div>
      </div>
      {(() => {
        if (!repositories.length) {
          return (
            <EmptyState
              title="暂无仓库"
              description="镜像首次推送后会出现在这里。"
              icon="package"
            />
          );
        }
        if (viewMode === "card") {
          return <RepositoryCards {...viewProps} />;
        }
        return (
          <RepositoryTable
            {...viewProps}
            sort={sort}
            onSort={onSort}
            onSelectAll={(selected) => {
              setSelectedIds(
                selected ? new Set(repositories.map(repositoryId)) : new Set(),
              );
            }}
          />
        );
      })()}
      <Pagination
        pagination={pagination}
        onPageChange={onPageChange}
        pageSizeOptions={[20, 50, 100]}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "view-mode-toggle": uiStyles0.viewModeToggle,
  button: uiStyles0.button,
  "icon-button": uiStyles0.iconButton,
  "repository-card-grid": uiStyles0.repositoryCardGrid,
  "repository-card": uiStyles0.repositoryCard,
  selected: uiStyles0.selected,
  mono: uiStyles0.mono,
  "table-scroll": uiStyles0.tableScroll,
  "data-table-stable": uiStyles0.dataTableStable,
  "selection-cell": uiStyles0.selectionCell,
  "table-cell-number": uiStyles0.tableCellNumber,
  "repository-metric-count": uiStyles0.repositoryMetricCount,
  "table-cell-time": uiStyles0.tableCellTime,
  "clickable-row": uiStyles0.clickableRow,
  "selected-row": uiStyles0.selectedRow,
  "cell-title": uiStyles0.cellTitle,
  "cell-stack": uiStyles0.cellStack,
  "truncate-cell": uiStyles0.truncateCell,
  "row-actions": uiStyles0.rowActions,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  "artifact-batch-toolbar": uiStyles0.artifactBatchToolbar,
  "button-danger": uiStyles0.buttonDanger,
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
  "repository-card-select": uiStyles1.repositoryCardSelect,
  "repository-select-table": uiStyles1.repositorySelectTable,
  "repository-batch-toolbar": uiStyles1.repositoryBatchToolbar,
});
