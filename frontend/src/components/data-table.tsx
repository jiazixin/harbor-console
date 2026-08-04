import { formatNumber } from "../app/formatters";
import { useLocale } from "../app/locale-context";
import type { ControlPagination } from "../app/models";
import { Icon } from "./icons";

export function SortableHeader({
  label,
  field,
  currentSort,
  className = "",
  descendingFirst = false,
  onSort,
}: {
  label: string;
  field: string;
  currentSort: string;
  className?: string;
  descendingFirst?: boolean;
  onSort: (sort: string) => void;
}) {
  const { locale, t } = useLocale();
  const ascending = currentSort === field;
  const descending = currentSort === `-${field}`;
  const nextSort = ascending
    ? `-${field}`
    : descending
      ? field
      : descendingFirst
        ? `-${field}`
        : field;
  const nextDirection = nextSort.startsWith("-") ? "降序" : "升序";
  const currentDirection = ascending ? "升序" : descending ? "降序" : "未排序";
  const englishNextDirection = nextSort.startsWith("-")
    ? "descending"
    : "ascending";
  const ariaLabel =
    locale === "en-US"
      ? `Sort by ${t(label)} ${englishNextDirection}`
      : `按${t(label)}${t(nextDirection)}排序`;
  const statusLabel =
    locale === "en-US"
      ? `${ascending ? "Sorted ascending" : descending ? "Sorted descending" : "Not sorted"}. Click to sort ${englishNextDirection}`
      : `当前${t(currentDirection)}，点击按${t(nextDirection)}排序`;
  return (
    <th
      className={className || undefined}
      aria-sort={ascending ? "ascending" : descending ? "descending" : "none"}
    >
      <button
        className={`table-sort-button${ascending || descending ? " is-active" : ""}`}
        type="button"
        aria-label={ariaLabel}
        onClick={() => onSort(nextSort)}
      >
        <span>{t(label)}</span>
        <span className="table-sort-indicator" aria-hidden="true">
          <Icon
            name="chevron"
            className={`table-sort-chevron${ascending ? " is-current" : ""}`}
          />
          <Icon
            name="chevron"
            className={`table-sort-chevron table-sort-chevron-desc${descending ? " is-current" : ""}`}
          />
        </span>
        <span className="sr-only">{statusLabel}</span>
      </button>
    </th>
  );
}

export function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: ControlPagination;
  onPageChange: (page: number) => void;
}) {
  const { locale, t } = useLocale();
  const totalPages = Math.max(
    1,
    Math.ceil(pagination.total / pagination.page_size),
  );
  const start = pagination.total
    ? (pagination.page - 1) * pagination.page_size + 1
    : 0;
  const end = Math.min(
    pagination.total,
    pagination.page * pagination.page_size,
  );
  const summary =
    locale === "en-US"
      ? `Items ${formatNumber(start, locale)}-${formatNumber(end, locale)} of ${formatNumber(pagination.total, locale)}`
      : `第 ${formatNumber(start, locale)}-${formatNumber(end, locale)} 项，共 ${formatNumber(pagination.total, locale)} 项`;
  const pageLabel =
    locale === "en-US"
      ? `Page ${formatNumber(pagination.page, locale)} of ${formatNumber(totalPages, locale)}`
      : `第 ${formatNumber(pagination.page, locale)} / ${formatNumber(totalPages, locale)} 页`;

  return (
    <div className="control-pagination">
      <span>{summary}</span>
      <div className="pagination-buttons">
        <button
          className="icon-button"
          type="button"
          disabled={pagination.page <= 1}
          title={locale === "en-US" ? "Previous" : t("上一页")}
          aria-label={locale === "en-US" ? "Previous" : t("上一页")}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          <Icon name="chevron-left" />
        </button>
        <span>{pageLabel}</span>
        <button
          className="icon-button"
          type="button"
          disabled={pagination.page >= totalPages}
          title={locale === "en-US" ? "Next" : t("下一页")}
          aria-label={locale === "en-US" ? "Next" : t("下一页")}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}
