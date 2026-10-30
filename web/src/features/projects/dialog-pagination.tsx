import { useLocale } from "../../app/locale-context";
import type { ControlPagination } from "../../app/models";
import { Icon } from "../../components/icon";
import { PageJumpControl } from "../../components/page-jump-control";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatNumber } from "../../lib/format/formatters";
import styles from "./projects.module.css";

type DialogPaginationProps = {
  pagination: ControlPagination;
  onPageChange: (page: number) => void;
};

export function DialogPagination({
  pagination,
  onPageChange,
}: DialogPaginationProps) {
  const { locale, t } = useLocale();
  const pages = Math.max(1, Math.ceil(pagination.total / pagination.page_size));
  const summary =
    locale === "en-US"
      ? `Page ${formatNumber(pagination.page, locale)} of ${formatNumber(pages, locale)}, ${formatNumber(pagination.total, locale)} items`
      : `第 ${formatNumber(pagination.page, locale)} / ${formatNumber(pages, locale)} 页，共 ${formatNumber(pagination.total, locale)} 项`;
  return (
    <div className={resolveClasses(styles.dialogPagination)}>
      <PageJumpControl
        label={summary}
        page={pagination.page}
        totalPages={pages}
        onPageChange={onPageChange}
      />
      <div>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => {
            onPageChange(pagination.page - 1);
          }}
        >
          <Icon name="chevron-left" />
          <span>{t("上一页")}</span>
        </button>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          disabled={pagination.page >= pages}
          onClick={() => {
            onPageChange(pagination.page + 1);
          }}
        >
          <span>{t("下一页")}</span>
          <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
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
});
