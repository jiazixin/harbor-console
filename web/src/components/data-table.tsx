import { useEffect, useRef, useState } from "react";

import { formatItemRange, formatNumber } from "../app/formatters";
import { useLocale } from "../app/locale-context";
import type { ControlPagination } from "../app/models";
import { Icon } from "./icons";
import { UnifiedSelect } from "./unified-select";

export function createSortValues(
  fields: readonly string[],
): ReadonlySet<string> {
  return new Set(fields.flatMap((field) => [field, `-${field}`]));
}

export function StableTableColumns({ widths }: { widths: readonly string[] }) {
  return (
    <colgroup>
      {widths.map((width, index) => (
        <col key={`${width}-${String(index)}`} style={{ width }} />
      ))}
    </colgroup>
  );
}

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
  const englishNextDirection = nextSort.startsWith("-")
    ? "descending"
    : "ascending";
  const ariaLabel =
    locale === "en-US"
      ? `Sort by ${t(label)} ${englishNextDirection}`
      : `按${t(label)}${t(nextDirection)}排序`;
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
      </button>
    </th>
  );
}

export function PageJumpControl({
  label,
  page,
  totalPages,
  onPageChange,
}: {
  label: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(page));
  const controlRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setValue(String(page));
    }
  }, [open, page]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function submit() {
    const requested = Number.parseInt(value, 10);
    const nextPage = Number.isFinite(requested)
      ? Math.min(totalPages, Math.max(1, requested))
      : page;
    setOpen(false);
    setValue(String(nextPage));
    if (nextPage !== page) onPageChange(nextPage);
  }

  return (
    <span ref={controlRef} className="pagination-page-control">
      {open ? (
        <span className="pagination-page-jump">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            aria-label={t("页码")}
            onChange={(event) => setValue(event.currentTarget.value)}
            onBlur={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
              }
            }}
          />
        </span>
      ) : (
        <button
          className="pagination-page-label"
          type="button"
          aria-label={t("跳转页码")}
          onClick={() => {
            setValue("");
            setOpen(true);
          }}
        >
          {label}
        </button>
      )}
    </span>
  );
}

export function Pagination({
  pagination,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
}: {
  pagination: ControlPagination;
  onPageChange: (page: number) => void;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
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
  const summary = formatItemRange(start, end, pagination.total, locale);
  const pageLabel =
    locale === "en-US"
      ? `Page ${formatNumber(pagination.page, locale)} of ${formatNumber(totalPages, locale)}`
      : `第 ${formatNumber(pagination.page, locale)} / ${formatNumber(totalPages, locale)} 页`;
  return (
    <div className="control-pagination">
      <div className="pagination-summary">
        <span>{summary}</span>
        {pageSizeOptions?.length && onPageSizeChange ? (
          <UnifiedSelect
            ariaLabel={t("每页条数")}
            className="pagination-page-size"
            value={String(pagination.page_size)}
            options={pageSizeOptions.map((pageSize) => ({
              value: String(pageSize),
              label:
                locale === "en-US"
                  ? `${String(pageSize)} per page`
                  : `${t("每页")} ${String(pageSize)} ${t("条")}`,
            }))}
            onChange={(pageSize) => onPageSizeChange(Number(pageSize))}
          />
        ) : null}
      </div>
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
        <PageJumpControl
          label={pageLabel}
          page={pagination.page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
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
