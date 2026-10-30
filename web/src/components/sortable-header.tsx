import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import { Icon } from "./icon";
import uiStyles0 from "./shared-ui.module.css";
import uiStyles1 from "./sortable-header.module.css";

type SortableHeaderProps = {
  label: string;
  field: string;
  currentSort: string;
  className?: string;
  descendingFirst?: boolean;
  onSort: (sort: string) => void;
};

export function SortableHeader({
  label,
  field,
  currentSort,
  className = "",
  descendingFirst = false,
  onSort,
}: SortableHeaderProps) {
  const { locale, t } = useLocale();
  const ascending = currentSort === field;
  const descending = currentSort === `-${field}`;
  const nextSort = (() => {
    if (ascending) {
      return `-${field}`;
    }
    if (descending) {
      return field;
    }
    if (descendingFirst) {
      return `-${field}`;
    }
    return field;
  })();
  const nextDirection = nextSort.startsWith("-") ? "降序" : "升序";
  const englishNextDirection = nextSort.startsWith("-")
    ? "descending"
    : "ascending";
  const ariaLabel =
    locale === "en-US"
      ? `Sort by ${t(label)} ${englishNextDirection}`
      : `按${t(label)}${t(nextDirection)}排序`;
  return (
    <th
      className={resolveClasses(className || undefined)}
      aria-sort={(() => {
        if (ascending) {
          return "ascending";
        }
        if (descending) {
          return "descending";
        }
        return "none";
      })()}
    >
      <button
        className={resolveClasses(
          `table-sort-button${ascending || descending ? " is-active" : ""}`,
        )}
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          onSort(nextSort);
        }}
      >
        <span>{t(label)}</span>
        <span
          className={resolveClasses("table-sort-indicator")}
          aria-hidden="true"
        >
          <Icon
            name="chevron"
            className={resolveClasses(
              `table-sort-chevron${ascending ? " is-current" : ""}`,
            )}
          />
          <Icon
            name="chevron"
            className={resolveClasses(
              `table-sort-chevron table-sort-chevron-desc${descending ? " is-current" : ""}`,
            )}
          />
        </span>
      </button>
    </th>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  button: uiStyles0.button,
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
  "table-sort-button": uiStyles1.tableSortButton,
  "is-active": uiStyles1.isActive,
  "table-sort-indicator": uiStyles1.tableSortIndicator,
  "table-sort-chevron": uiStyles1.tableSortChevron,
  "is-current": uiStyles1.isCurrent,
  "table-sort-chevron-desc": uiStyles1.tableSortChevronDesc,
});
