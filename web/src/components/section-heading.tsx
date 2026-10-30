import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import { formatCount } from "../lib/format/formatters";
import uiStyles0 from "./shared-ui.module.css";

type SectionHeadingProps = {
  title: string;
  total?: number;
  zhUnit?: string;
  enUnit?: string;
  loading?: boolean;
  error?: boolean;
};

export function SectionHeading({
  title,
  total,
  zhUnit = "个",
  enUnit = "items",
  loading = false,
  error = false,
}: SectionHeadingProps) {
  const { locale, t } = useLocale();
  const count = (() => {
    if (loading) {
      return t("正在载入");
    }
    if (error || total === undefined) {
      return t("统计不可用");
    }
    return formatCount({
      total: total,
      locale: locale,
      chineseUnit: zhUnit,
      englishUnit: enUnit,
    });
  })();
  return (
    <div className={resolveClasses("section-heading")}>
      <h2>
        {t(title)}{" "}
        <span className={resolveClasses("section-count")}>{count}</span>
      </h2>
    </div>
  );
}

const resolveClasses = createClassNames({
  "section-heading": uiStyles0.sectionHeading,
  "section-count": uiStyles0.sectionCount,
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
