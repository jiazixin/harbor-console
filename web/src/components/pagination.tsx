import { useLocale } from "../app/locale-context";
import type { ControlPagination } from "../app/models";
import { createClassNames } from "../lib/css/class-names";
import { formatItemRange, formatNumber } from "../lib/format/formatters";
import { Icon } from "./icon";
import { PageJumpControl } from "./page-jump-control";
import uiStyles1 from "./pagination.module.css";
import uiStyles0 from "./shared-ui.module.css";
import { UnifiedSelect } from "./unified-select";

type PaginationProps = {
  pagination: ControlPagination;
  onPageChange: (page: number) => void;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
};

export function Pagination({
  pagination,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
}: PaginationProps) {
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
  const summary = formatItemRange({
    start: start,
    end: end,
    total: pagination.total,
    locale: locale,
  });
  const pageLabel =
    locale === "en-US"
      ? `Page ${formatNumber(pagination.page, locale)} of ${formatNumber(totalPages, locale)}`
      : `第 ${formatNumber(pagination.page, locale)} / ${formatNumber(totalPages, locale)} 页`;
  return (
    <div className={resolveClasses("control-pagination")}>
      <div className={resolveClasses("pagination-summary")}>
        <span>{summary}</span>
        {pageSizeOptions?.length && onPageSizeChange ? (
          <UnifiedSelect
            ariaLabel={t("每页条数")}
            className={resolveClasses("pagination-page-size")}
            value={String(pagination.page_size)}
            options={pageSizeOptions.map((pageSize) => ({
              value: String(pageSize),
              label:
                locale === "en-US"
                  ? `${String(pageSize)} per page`
                  : `${t("每页")} ${String(pageSize)} ${t("条")}`,
            }))}
            onChange={(pageSize) => {
              onPageSizeChange(Number(pageSize));
            }}
          />
        ) : null}
      </div>
      <div className={resolveClasses("pagination-buttons")}>
        <button
          className={resolveClasses("icon-button")}
          type="button"
          disabled={pagination.page <= 1}
          title={locale === "en-US" ? "Previous" : t("上一页")}
          aria-label={locale === "en-US" ? "Previous" : t("上一页")}
          onClick={() => {
            onPageChange(pagination.page - 1);
          }}
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
          className={resolveClasses("icon-button")}
          type="button"
          disabled={pagination.page >= totalPages}
          title={locale === "en-US" ? "Next" : t("下一页")}
          aria-label={locale === "en-US" ? "Next" : t("下一页")}
          onClick={() => {
            onPageChange(pagination.page + 1);
          }}
        >
          <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "unified-select": uiStyles0.unifiedSelect,
  "icon-button": uiStyles0.iconButton,
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
  "control-pagination": uiStyles1.controlPagination,
  "pagination-summary": uiStyles1.paginationSummary,
  "pagination-page-size": uiStyles1.paginationPageSize,
  "pagination-buttons": uiStyles1.paginationButtons,
});
