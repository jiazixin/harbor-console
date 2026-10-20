import { type SubmitEvent, useEffect, useRef } from "react";

import { formatDate, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type { ProjectSummary } from "../../app/models";
import {
  SortableHeader,
  StableTableColumns,
} from "../../components/data-table";
import { Icon } from "../../components/icons";
import { OverflowText } from "../../components/overflow-text";
import { StatCell } from "../../components/page-elements";
import { severityLabel } from "../../components/status-badge";
import { UnifiedSelect } from "../../components/unified-select";
import { useResettableState } from "../../components/use-resettable-state";
import {
  metadataEnabled,
  projectNumber,
  type ProjectRouteState,
  type ProjectVisibility,
} from "./project-list-data";

export function ProjectOverviewStats({
  projects,
  error,
}: {
  projects?: ProjectSummary[];
  error: string;
}) {
  const { locale, t } = useLocale();
  const loading = projects === undefined && !error;
  const total = projects?.length ?? 0;
  const enabledCount = (field: "auto_scan" | "prevent_vul") =>
    projects?.filter((project) => metadataEnabled(project, field)).length ?? 0;
  const coverage = (enabled: number) =>
    total ? `${String(Math.round((enabled / total) * 100))}%` : "0%";
  const footnote = (ready: string) =>
    loading ? t("正在载入") : error ? t("统计不可用") : ready;
  const enabledFootnote = (count: number) =>
    footnote(`${t("已启用")} ${formatNumber(count, locale)} ${t("个")}`);
  const autoScan = enabledCount("auto_scan");
  const blocking = enabledCount("prevent_vul");
  const repositoryCount =
    projects?.reduce(
      (sum, project) => sum + projectNumber(project.repo_count),
      0,
    ) ?? 0;
  return (
    <section
      className="overview-stats project-overview-stats"
      aria-label={t("项目中心概览")}
      aria-busy={loading}
    >
      <StatCell
        label={t("项目总数")}
        value={projects ? formatNumber(total, locale) : "-"}
        foot={footnote(t("当前账号可见项目"))}
        icon="folder"
      />
      <StatCell
        label={t("仓库数量")}
        value={projects ? formatNumber(repositoryCount, locale) : "-"}
        foot={footnote(t("当前筛选结果"))}
        icon="package"
      />
      <StatCell
        label={t("自动扫描覆盖")}
        value={projects ? coverage(autoScan) : "-"}
        foot={enabledFootnote(autoScan)}
        icon="scan"
      />
      <StatCell
        label={t("漏洞阻止覆盖")}
        value={projects ? coverage(blocking) : "-"}
        foot={enabledFootnote(blocking)}
        icon="bug"
      />
    </section>
  );
}

type ProjectFilters = Pick<ProjectRouteState, "owner" | "query" | "visibility">;

export function ProjectFilterForm({
  filters,
  onApply,
}: {
  filters: ProjectFilters;
  onApply: (filters: ProjectFilters) => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useResettableState(filters.query);
  const [owner, setOwner] = useResettableState(filters.owner);
  const [visibility, setVisibility] = useResettableState<ProjectVisibility>(
    filters.visibility,
  );
  const hasActiveFilters = Boolean(
    filters.query || filters.visibility || filters.owner,
  );

  return (
    <form
      className="table-toolbar project-filter-toolbar"
      onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        onApply({ query: name.trim(), owner: owner.trim(), visibility });
      }}
    >
      <div className="toolbar-search">
        <Icon name="search" />
        <input
          name="name"
          type="search"
          maxLength={255}
          value={name}
          placeholder={t("按项目名称搜索")}
          aria-label={t("按项目名称搜索")}
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </div>
      <div className="toolbar-search project-owner-search">
        <Icon name="users" />
        <input
          name="owner"
          type="search"
          maxLength={255}
          value={owner}
          placeholder={t("项目所有者")}
          aria-label={t("按项目所有者筛选")}
          onChange={(event) => setOwner(event.currentTarget.value)}
        />
      </div>
      <label className="toolbar-field">
        <span>{t("可见性")}</span>
        <UnifiedSelect
          name="visibility"
          className="toolbar-select"
          value={visibility}
          ariaLabel={t("可见性")}
          options={[
            { value: "", label: t("全部项目") },
            { value: "public", label: t("公开") },
            { value: "private", label: t("私有") },
          ]}
          onChange={setVisibility}
        />
      </label>
      <button className="button button-small button-primary" type="submit">
        <Icon name="search" />
        <span>{t("筛选")}</span>
      </button>
      {hasActiveFilters ? (
        <button
          className="button button-small"
          type="button"
          onClick={() => onApply({ query: "", owner: "", visibility: "" })}
        >
          {t("取消筛选")}
        </button>
      ) : null}
    </form>
  );
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}

export function ProjectTable({
  projects,
  selectedIds,
  sort,
  onSort,
  onSelect,
  onSelectAll,
  onOpen,
}: {
  projects: ProjectSummary[];
  selectedIds: ReadonlySet<number>;
  sort: string;
  onSort: (sort: string) => void;
  onSelect: (project: ProjectSummary, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onOpen: (project: ProjectSummary) => void;
}) {
  const { locale, t } = useLocale();
  const selectedCount = projects.filter((project) =>
    selectedIds.has(projectNumber(project.project_id)),
  ).length;
  const allSelected = selectedCount > 0 && selectedCount === projects.length;
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
      <table className="project-select-table data-table-stable">
        <StableTableColumns
          widths={[
            "44px",
            "auto",
            "112px",
            "104px",
            "128px",
            "168px",
            "150px",
            "44px",
          ]}
        />
        <thead>
          <tr>
            <th className="selection-cell">
              <SelectAllCheckbox
                checked={allSelected}
                indeterminate={selectedCount > 0 && !allSelected}
                label={t("选择当前页全部项目")}
                onChange={onSelectAll}
              />
            </th>
            {header("项目", "name")}
            {header("可见性", "public", "table-cell-center")}
            {header(
              "仓库数",
              "repo_count",
              "table-cell-number project-repository-count",
              true,
            )}
            {header("自动扫描", "auto_scan", "table-cell-center", true)}
            {header("漏洞阻止", "prevent_vul", "table-cell-center", true)}
            {header("最近更新", "update_time", "table-cell-time", true)}
            <th />
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const id = projectNumber(project.project_id);
            const selected = selectedIds.has(id);
            const publicProject = metadataEnabled(project, "public");
            const autoScan = metadataEnabled(project, "auto_scan");
            const blocking = metadataEnabled(project, "prevent_vul");
            return (
              <tr
                key={id || project.name}
                className={`clickable-row${selected ? " selected-row" : ""}`}
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (!target.closest("input, button, a")) onOpen(project);
                }}
              >
                <td className="selection-cell">
                  <input
                    type="checkbox"
                    checked={selected}
                    aria-label={`${t("选择")} ${project.name}`}
                    onChange={(event) =>
                      onSelect(project, event.currentTarget.checked)
                    }
                  />
                </td>
                <td>
                  <div className="cell-title">
                    <span className="cell-stack">
                      <OverflowText as="strong">{project.name}</OverflowText>
                      <small>
                        {project.owner_name ?? "-"} · #
                        {project.project_id ?? "-"}
                      </small>
                    </span>
                  </div>
                </td>
                <td className="table-cell-center">
                  <span
                    className={`badge${publicProject ? " badge-blue" : ""}`}
                  >
                    {t(publicProject ? "公开" : "私有")}
                  </span>
                </td>
                <td className="mono table-cell-number project-repository-count">
                  {formatNumber(project.repo_count, locale)}
                </td>
                <td className="table-cell-center">
                  <span className={`badge${autoScan ? " badge-green" : ""}`}>
                    {t(autoScan ? "已启用" : "未启用")}
                  </span>
                </td>
                <td className="table-cell-center">
                  <span className={`badge${blocking ? " badge-green" : ""}`}>
                    {blocking
                      ? `${t(severityLabel(project.metadata?.severity))}${locale === "en-US" ? " and above" : "及以上"}`
                      : t("未启用")}
                  </span>
                </td>
                <td className="table-cell-time">
                  {formatDate(
                    project.update_time ?? project.creation_time,
                    locale,
                  )}
                </td>
                <td>
                  <Icon name="chevron" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
