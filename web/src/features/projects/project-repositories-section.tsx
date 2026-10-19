import { type MouseEvent, useMemo, useState } from "react";

import { formatDate, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type { ControlPagination, RepositorySummary } from "../../app/models";
import {
  Pagination,
  SortableHeader,
  StableTableColumns,
} from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icons";
import { ToolbarSearchForm } from "../../components/toolbar-search-form";
import { ViewModeToggle } from "../../components/view-mode-toggle";

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

function SelectionCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}

function PushGuideButton({ onClick }: { onClick: () => void }) {
  const { t } = useLocale();
  return (
    <button
      className="icon-button"
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
    <div className="repository-card-grid">
      {repositories.map((repository) => {
        const id = repositoryId(repository);
        const selected = selectedIds.has(id);
        const name = nameWithinProject(project, repository.name);
        return (
          <article
            key={id || repository.name}
            className={`repository-card${selected ? " selected" : ""}`}
            onClick={(event) => {
              if (isRowClick(event)) onOpen(repository);
            }}
          >
            <header>
              <label className="repository-card-select">
                <SelectionCheckbox
                  label={`${t("选择")} ${name}`}
                  checked={selected}
                  onChange={(checked) => onSelect(id, checked)}
                />
              </label>
              <div>
                <button type="button" onClick={() => onOpen(repository)}>
                  {name}
                </button>
                <span className="mono">#{repository.id ?? "-"}</span>
              </div>
              <PushGuideButton onClick={() => onShowPushCommand(repository)} />
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
                <dd>{formatDate(repository.update_time, locale)}</dd>
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
  const header = (
    label: string,
    field: string,
    className?: string,
    descendingFirst = false,
  ) => (
    <SortableHeader
      label={label}
      field={field}
      className={className}
      descendingFirst={descendingFirst}
      currentSort={sort}
      onSort={onSort}
    />
  );
  return (
    <div className="table-scroll">
      <table className="repository-select-table data-table-stable">
        <StableTableColumns
          widths={["44px", "30%", "11%", "11%", "20%", "144px", "44px"]}
        />
        <thead>
          <tr>
            <th className="selection-cell">
              <SelectionCheckbox
                label={t("选择当前页全部仓库")}
                checked={allSelected}
                onChange={onSelectAll}
              />
            </th>
            {header("仓库", "name")}
            {header(
              "制品",
              "artifact_count",
              "table-cell-number repository-metric-count",
              true,
            )}
            {header(
              "拉取次数",
              "pull_count",
              "table-cell-number repository-metric-count",
              true,
            )}
            <th>{t("描述")}</th>
            {header("最近更新", "update_time", "table-cell-time", true)}
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
                className={`clickable-row${selected ? " selected-row" : ""}`}
                onClick={(event) => {
                  if (isRowClick(event)) onOpen(repository);
                }}
              >
                <td className="selection-cell">
                  <SelectionCheckbox
                    label={`${t("选择")} ${name}`}
                    checked={selected}
                    onChange={(checked) => onSelect(id, checked)}
                  />
                </td>
                <td>
                  <div className="cell-title">
                    <span className="cell-stack">
                      <strong>{name}</strong>
                      <small className="mono">#{repository.id ?? "-"}</small>
                    </span>
                  </div>
                </td>
                <td className="mono table-cell-number repository-metric-count">
                  {formatNumber(repository.artifact_count, locale)}
                </td>
                <td className="mono table-cell-number repository-metric-count">
                  {formatNumber(repository.pull_count, locale)}
                </td>
                <td className="truncate-cell">
                  {repository.description?.trim()
                    ? repository.description
                    : "-"}
                </td>
                <td className="table-cell-time">
                  {formatDate(repository.update_time, locale)}
                </td>
                <td>
                  <div className="row-actions">
                    <PushGuideButton
                      onClick={() => onShowPushCommand(repository)}
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
}: {
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
}) {
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

  const selectedRepositories = useMemo(
    () =>
      repositories.filter((repository) =>
        selectedIds.has(repositoryId(repository)),
      ),
    [repositories, selectedIds],
  );
  const select = (id: number, selected: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  const viewProps: RepositoryViewProps = {
    project,
    repositories,
    selectedIds,
    onSelect: select,
    onOpen,
    onShowPushCommand,
  };

  return (
    <section className="table-shell">
      <div className="table-toolbar">
        <ToolbarSearchForm
          name="q"
          placeholder="按仓库名称搜索"
          value={draftQuery}
          onChange={setDraftQuery}
          onSubmit={onSearch}
        />
        <button
          className="button button-small button-primary"
          type="button"
          onClick={() => onShowPushCommand()}
        >
          <Icon name="upload" />
          <span>{t("推送镜像")}</span>
        </button>
        <div className="toolbar-spacer" />
        <ViewModeToggle
          value={viewMode}
          ariaLabel={t("仓库展示方式")}
          listLabel={t("列表视图")}
          cardLabel={t("卡片视图")}
          onChange={onViewModeChange}
        />
      </div>
      <div className="artifact-batch-toolbar repository-batch-toolbar">
        <span>
          <strong>{formatNumber(selectedRepositories.length, locale)}</strong>{" "}
          {t("个已选择")}
        </span>
        <div>
          <button
            className="button button-small button-danger"
            type="button"
            disabled={!selectedRepositories.length}
            onClick={() => onDeleteRepositories(selectedRepositories)}
          >
            <Icon name="trash" />
            <span>{t("删除仓库")}</span>
          </button>
        </div>
      </div>
      {!repositories.length ? (
        <EmptyState
          title="暂无仓库"
          description="镜像首次推送后会出现在这里。"
          icon="package"
        />
      ) : viewMode === "card" ? (
        <RepositoryCards {...viewProps} />
      ) : (
        <RepositoryTable
          {...viewProps}
          sort={sort}
          onSort={onSort}
          onSelectAll={(selected) =>
            setSelectedIds(
              selected ? new Set(repositories.map(repositoryId)) : new Set(),
            )
          }
        />
      )}
      <Pagination
        pagination={pagination}
        onPageChange={onPageChange}
        pageSizeOptions={[20, 50, 100]}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}
