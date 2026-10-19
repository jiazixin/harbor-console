import { type FormEvent, type MouseEvent } from "react";

import { formatDate, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type { ProjectSummary } from "../../app/models";
import {
  SortableHeader,
  StableTableColumns,
} from "../../components/data-table";
import { Icon } from "../../components/icons";
import { StatCell } from "../../components/page-elements";
import { UnifiedSelect } from "../../components/unified-select";
import { useResettableState } from "../../components/use-resettable-state";
import { ViewModeToggle } from "../../components/view-mode-toggle";
import {
  nameWithinProject,
  projectRepositoriesHref,
  type RepositoryAsset,
  repositoryAssetKey,
} from "./repository-asset-data";
import { repositoryTimestamp } from "./repository-sorting";

type ViewMode = "card" | "list";

function numberValue(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function RepositoryAssetStats({
  repositories,
  projectCount,
  loading,
  unavailable,
}: {
  /** Undefined until the first load finishes. */
  repositories?: RepositoryAsset[];
  projectCount: number;
  loading: boolean;
  unavailable: boolean;
}) {
  const { locale, t } = useLocale();
  const items = repositories ?? [];
  const sum = (field: "artifact_count" | "pull_count") =>
    items.reduce(
      (total, repository) => total + numberValue(repository[field]),
      0,
    );
  const latestUpdate = items.reduce<string | undefined>(
    (latest, repository) =>
      repositoryTimestamp(repository.update_time) > repositoryTimestamp(latest)
        ? repository.update_time
        : latest,
    undefined,
  );
  const value = (ready: () => string) => (repositories ? ready() : "-");
  const footnote = (ready: string) =>
    loading ? t("正在载入") : unavailable ? t("统计不可用") : ready;
  return (
    <section
      className="overview-stats repository-asset-stats"
      aria-label={t("镜像仓库统计")}
      aria-busy={loading}
    >
      <StatCell
        label={t("镜像仓库")}
        value={value(() => formatNumber(items.length, locale))}
        foot={footnote(`${formatNumber(projectCount, locale)} ${t("个项目")}`)}
        icon="package"
      />
      <StatCell
        label={t("制品总数")}
        value={value(() => formatNumber(sum("artifact_count"), locale))}
        foot={footnote(t("跨项目统计"))}
        icon="database"
      />
      <StatCell
        label={t("累计拉取")}
        value={value(() => formatNumber(sum("pull_count"), locale))}
        foot={footnote(t("Harbor 记录值"))}
        icon="history"
      />
      <StatCell
        label={t("最近更新")}
        value={value(() => formatDate(latestUpdate, locale, false))}
        foot={footnote(t("Harbor 仓库更新时间"))}
        icon="upload"
      />
    </section>
  );
}

export function RepositoryAssetToolbar({
  query,
  project,
  projects,
  viewMode,
  onSearch,
  onProjectChange,
  onClear,
  onViewModeChange,
}: {
  query: string;
  project: string;
  projects: ProjectSummary[];
  viewMode: ViewMode;
  onSearch: (query: string) => void;
  onProjectChange: (project: string) => void;
  onClear: () => void;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const { t } = useLocale();
  const [draftQuery, setDraftQuery] = useResettableState(query);
  const projectOptions = [
    { value: "", label: t("全部项目") },
    ...projects.map(({ name }) => ({ value: name, label: name })),
  ];

  return (
    <form
      className="table-toolbar repository-asset-toolbar"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSearch(draftQuery.trim());
      }}
    >
      <div className="repository-asset-toolbar-primary">
        <div className="toolbar-search">
          <Icon name="search" />
          <input
            name="q"
            type="search"
            maxLength={255}
            value={draftQuery}
            placeholder={t("搜索项目或仓库")}
            aria-label={t("搜索项目或仓库")}
            onChange={(event) => setDraftQuery(event.currentTarget.value)}
          />
        </div>
        <label className="toolbar-field">
          <span>{t("项目")}</span>
          <UnifiedSelect
            ariaLabel={t("项目")}
            className="toolbar-select"
            value={project}
            options={projectOptions}
            onChange={onProjectChange}
          />
        </label>
        <button className="button button-small button-primary" type="submit">
          <Icon name="search" />
          <span>{t("筛选")}</span>
        </button>
        {query || project ? (
          <button
            className="button button-small"
            type="button"
            onClick={onClear}
          >
            {t("取消筛选")}
          </button>
        ) : null}
      </div>
      <div className="repository-asset-toolbar-actions">
        <ViewModeToggle
          value={viewMode}
          ariaLabel={t("仓库展示方式")}
          listLabel={t("列表视图")}
          cardLabel={t("卡片视图")}
          onChange={onViewModeChange}
        />
      </div>
    </form>
  );
}

export function RepositoryAssetCards({
  repositories,
  onOpen,
  onShowPushCommand,
}: {
  repositories: RepositoryAsset[];
  onOpen: (repository: RepositoryAsset) => void;
  onShowPushCommand: (repository: RepositoryAsset) => void;
}) {
  const { locale, t } = useLocale();
  return (
    <div className="repository-card-grid repository-asset-card-grid">
      {repositories.map((repository) => (
        <article
          key={repositoryAssetKey(repository)}
          className="repository-card"
        >
          <header>
            <div>
              <button type="button" onClick={() => onOpen(repository)}>
                {nameWithinProject(repository)}
              </button>
              <a href={projectRepositoriesHref(repository.project_name)}>
                {repository.project_name}
              </a>
            </div>
            <button
              className="icon-button"
              type="button"
              title={t("推送指引")}
              aria-label={t("查看推送指引")}
              onClick={() => onShowPushCommand(repository)}
            >
              <Icon name="upload" />
            </button>
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
      ))}
    </div>
  );
}

export function RepositoryAssetTable({
  repositories,
  sort,
  onSort,
  onOpen,
}: {
  repositories: RepositoryAsset[];
  sort: string;
  onSort: (sort: string) => void;
  onOpen: (repository: RepositoryAsset) => void;
}) {
  const { locale, t } = useLocale();
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
  // Clicks on the row itself open the repository; links keep their own target.
  const openRow = (
    event: MouseEvent<HTMLElement>,
    repository: RepositoryAsset,
  ) => {
    if (!(event.target as HTMLElement).closest("input, button, a")) {
      onOpen(repository);
    }
  };
  return (
    <div className="table-scroll">
      <table className="data-table-stable repository-asset-table">
        <StableTableColumns
          widths={["28%", "16%", "11%", "11%", "14%", "16%", "44px"]}
        />
        <thead>
          <tr>
            {header("仓库", "name")}
            <th>{t("项目")}</th>
            {header("制品数", "artifact_count", "table-cell-number", true)}
            {header("拉取次数", "pull_count", "table-cell-number", true)}
            {header("创建时间", "creation_time", "table-cell-time", true)}
            {header("最近更新", "update_time", "table-cell-time", true)}
            <th />
          </tr>
        </thead>
        <tbody>
          {repositories.map((repository) => (
            <tr
              key={repositoryAssetKey(repository)}
              className="clickable-row"
              onClick={(event) => openRow(event, repository)}
            >
              <td>
                <div className="cell-title">
                  <span className="cell-stack">
                    <strong>{nameWithinProject(repository)}</strong>
                    <small className="mono">#{repository.id ?? "-"}</small>
                  </span>
                </div>
              </td>
              <td>
                <a href={projectRepositoriesHref(repository.project_name)}>
                  {repository.project_name}
                </a>
              </td>
              <td className="mono table-cell-number repository-metric-count">
                {formatNumber(repository.artifact_count, locale)}
              </td>
              <td className="mono table-cell-number repository-metric-count">
                {formatNumber(repository.pull_count, locale)}
              </td>
              <td className="table-cell-time">
                {formatDate(repository.creation_time, locale)}
              </td>
              <td className="table-cell-time">
                {formatDate(repository.update_time, locale)}
              </td>
              <td>
                <Icon name="chevron" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
