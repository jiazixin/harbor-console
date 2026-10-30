import { type MouseEvent } from "react";
import { useLocale } from "../../app/locale-context";
import { displayTimeZone } from "../../app/preferences";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { SortableHeader } from "../../components/sortable-header";
import { StableTableColumns } from "../../components/stable-table-columns";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, formatNumber } from "../../lib/format/formatters";
import {
  nameWithinProject,
  projectRepositoriesHref,
  type RepositoryAsset,
  repositoryAssetKey,
} from "./repository-asset-data";
import uiStyles1 from "./shared-ui.module.css";

type RepositoryAssetTableProps = {
  repositories: RepositoryAsset[];
  sort: string;
  onSort: (sort: string) => void;
  onOpen: (repository: RepositoryAsset) => void;
};

export function RepositoryAssetTable({
  repositories,
  sort,
  onSort,
  onOpen,
}: RepositoryAssetTableProps) {
  const { locale, t } = useLocale();
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
    <div className={resolveClasses("table-scroll")}>
      <table
        className={resolveClasses("data-table-stable repository-asset-table")}
      >
        <StableTableColumns
          widths={["28%", "16%", "11%", "11%", "14%", "16%", "44px"]}
        />
        <thead>
          <tr>
            {header({ label: "仓库", field: "name" })}
            <th>{t("项目")}</th>
            {header({
              label: "制品数",
              field: "artifact_count",
              className: "table-cell-number",
              descendingFirst: true,
            })}
            {header({
              label: "拉取次数",
              field: "pull_count",
              className: "table-cell-number",
              descendingFirst: true,
            })}
            {header({
              label: "创建时间",
              field: "creation_time",
              className: "table-cell-time",
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
          {repositories.map((repository) => (
            <tr
              key={repositoryAssetKey(repository)}
              className={resolveClasses("clickable-row")}
              onClick={(event) => {
                openRow(event, repository);
              }}
            >
              <td>
                <div className={resolveClasses("cell-title")}>
                  <span className={resolveClasses("cell-stack")}>
                    <strong>{nameWithinProject(repository)}</strong>
                    <small className={resolveClasses("mono")}>
                      #{repository.id ?? "-"}
                    </small>
                  </span>
                </div>
              </td>
              <td>
                <a href={projectRepositoriesHref(repository.project_name)}>
                  {repository.project_name}
                </a>
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
              <td className={resolveClasses("table-cell-time")}>
                {formatDate(repository.creation_time, {
                  locale: locale,
                  timeZone: displayTimeZone(),
                })}
              </td>
              <td className={resolveClasses("table-cell-time")}>
                {formatDate(repository.update_time, {
                  locale: locale,
                  timeZone: displayTimeZone(),
                })}
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

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  button: uiStyles0.button,
  "table-scroll": uiStyles0.tableScroll,
  "data-table-stable": uiStyles0.dataTableStable,
  "table-cell-number": uiStyles0.tableCellNumber,
  "table-cell-time": uiStyles0.tableCellTime,
  "clickable-row": uiStyles0.clickableRow,
  "cell-title": uiStyles0.cellTitle,
  "cell-stack": uiStyles0.cellStack,
  mono: uiStyles0.mono,
  "repository-metric-count": uiStyles0.repositoryMetricCount,
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
  "repository-asset-table": uiStyles1.repositoryAssetTable,
});
