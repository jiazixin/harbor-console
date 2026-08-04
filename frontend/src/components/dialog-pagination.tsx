import { formatNumber } from "../app/formatters";
import { useLocale } from "../app/locale-context";
import type { ControlPagination } from "../app/models";
import { Icon } from "./icons";

export function DialogPagination({
  pagination,
  onPageChange,
}: {
  pagination: ControlPagination;
  onPageChange: (page: number) => void;
}) {
  const { locale, t } = useLocale();
  const pages = Math.max(1, Math.ceil(pagination.total / pagination.page_size));
  const summary =
    locale === "en-US"
      ? `Page ${formatNumber(pagination.page, locale)} of ${formatNumber(pages, locale)}, ${formatNumber(pagination.total, locale)} items`
      : `第 ${formatNumber(pagination.page, locale)} / ${formatNumber(pages, locale)} 页，共 ${formatNumber(pagination.total, locale)} 项`;
  return (
    <div className="dialog-pagination">
      <span>{summary}</span>
      <div>
        <button
          className="button button-small"
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          <Icon name="chevron-left" />
          <span>{t("上一页")}</span>
        </button>
        <button
          className="button button-small"
          type="button"
          disabled={pagination.page >= pages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          <span>{t("下一页")}</span>
          <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}
