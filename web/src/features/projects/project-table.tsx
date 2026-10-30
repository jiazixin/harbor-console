import { useEffect, useRef } from "react";
import { useLocale } from "../../app/locale-context";
import type { ProjectSummary } from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import { OverflowText } from "../../components/overflow-text";
import uiStyles0 from "../../components/shared-ui.module.css";
import { SortableHeader } from "../../components/sortable-header";
import { StableTableColumns } from "../../components/stable-table-columns";
import { severityLabel } from "../../components/status-badge-support";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, formatNumber } from "../../lib/format/formatters";
import { metadataEnabled, projectNumber } from "./project-list-data";
import uiStyles1 from "./project-table.module.css";

type SelectAllCheckboxProps = {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

function SelectAllCheckbox({
  checked,
  indeterminate,
  label,
  onChange,
}: SelectAllCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const previous = input.indeterminate;
    input.indeterminate = indeterminate;
    return () => {
      input.indeterminate = previous;
    };
  }, [indeterminate]);
  return (
    <FormInput
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(event) => {
        onChange(event.currentTarget.checked);
      }}
    />
  );
}

type ProjectTableProps = {
  projects: ProjectSummary[];
  selectedIds: ReadonlySet<number>;
  sort: string;
  onSort: (sort: string) => void;
  onSelect: (project: ProjectSummary, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onOpen: (project: ProjectSummary) => void;
};

export function ProjectTable({
  projects,
  selectedIds,
  sort,
  onSort,
  onSelect,
  onSelectAll,
  onOpen,
}: ProjectTableProps) {
  const { locale, t } = useLocale();
  const selectedCount = projects.filter((project) =>
    selectedIds.has(projectNumber(project.project_id)),
  ).length;
  const allSelected = selectedCount > 0 && selectedCount === projects.length;
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
        className={resolveClasses("project-select-table data-table-stable")}
      >
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
            <th className={resolveClasses("selection-cell")}>
              <SelectAllCheckbox
                checked={allSelected}
                indeterminate={selectedCount > 0 && !allSelected}
                label={t("选择当前页全部项目")}
                onChange={onSelectAll}
              />
            </th>
            {header({ label: "项目", field: "name" })}
            {header({
              label: "可见性",
              field: "public",
              className: "table-cell-center",
            })}
            {header({
              label: "仓库数",
              field: "repo_count",
              className: "table-cell-number project-repository-count",
              descendingFirst: true,
            })}
            {header({
              label: "自动扫描",
              field: "auto_scan",
              className: "table-cell-center",
              descendingFirst: true,
            })}
            {header({
              label: "漏洞阻止",
              field: "prevent_vul",
              className: "table-cell-center",
              descendingFirst: true,
            })}
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
          {projects.map((project) => {
            const id = projectNumber(project.project_id);
            const selected = selectedIds.has(id);
            const publicProject = metadataEnabled(project, "public");
            const autoScan = metadataEnabled(project, "auto_scan");
            const blocking = metadataEnabled(project, "prevent_vul");
            return (
              <tr
                key={id || project.name}
                className={resolveClasses(
                  `clickable-row${selected ? " selected-row" : ""}`,
                )}
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (!target.closest("input, button, a")) onOpen(project);
                }}
              >
                <td className={resolveClasses("selection-cell")}>
                  <FormInput
                    type="checkbox"
                    checked={selected}
                    aria-label={`${t("选择")} ${project.name}`}
                    onChange={(event) => {
                      onSelect(project, event.currentTarget.checked);
                    }}
                  />
                </td>
                <td>
                  <div className={resolveClasses("cell-title")}>
                    <span className={resolveClasses("cell-stack")}>
                      <OverflowText as="strong">{project.name}</OverflowText>
                      <small>
                        {project.owner_name ?? "-"} · #
                        {project.project_id ?? "-"}
                      </small>
                    </span>
                  </div>
                </td>
                <td className={resolveClasses("table-cell-center")}>
                  <span
                    className={resolveClasses(
                      `badge${publicProject ? " badge-blue" : ""}`,
                    )}
                  >
                    {t(publicProject ? "公开" : "私有")}
                  </span>
                </td>
                <td
                  className={resolveClasses(
                    "mono table-cell-number project-repository-count",
                  )}
                >
                  {formatNumber(project.repo_count, locale)}
                </td>
                <td className={resolveClasses("table-cell-center")}>
                  <span
                    className={resolveClasses(
                      `badge${autoScan ? " badge-green" : ""}`,
                    )}
                  >
                    {t(autoScan ? "已启用" : "未启用")}
                  </span>
                </td>
                <td className={resolveClasses("table-cell-center")}>
                  <span
                    className={resolveClasses(
                      `badge${blocking ? " badge-green" : ""}`,
                    )}
                  >
                    {blocking
                      ? `${t(severityLabel(project.metadata?.severity))}${locale === "en-US" ? " and above" : "及以上"}`
                      : t("未启用")}
                  </span>
                </td>
                <td className={resolveClasses("table-cell-time")}>
                  {formatDate(project.update_time ?? project.creation_time, {
                    locale: locale,
                    timeZone: displayTimeZone(),
                  })}
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

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "overflow-text": uiStyles0.overflowText,
  "table-scroll": uiStyles0.tableScroll,
  "data-table-stable": uiStyles0.dataTableStable,
  "selection-cell": uiStyles0.selectionCell,
  "table-cell-center": uiStyles0.tableCellCenter,
  "table-cell-number": uiStyles0.tableCellNumber,
  "table-cell-time": uiStyles0.tableCellTime,
  "clickable-row": uiStyles0.clickableRow,
  "selected-row": uiStyles0.selectedRow,
  button: uiStyles0.button,
  "cell-title": uiStyles0.cellTitle,
  "cell-stack": uiStyles0.cellStack,
  badge: uiStyles0.badge,
  "badge-blue": uiStyles0.badgeBlue,
  mono: uiStyles0.mono,
  "badge-green": uiStyles0.badgeGreen,
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
  "project-select-table": uiStyles1.projectSelectTable,
  "project-repository-count": uiStyles1.projectRepositoryCount,
});
