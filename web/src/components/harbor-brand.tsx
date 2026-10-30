import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./harbor-brand.module.css";
import uiStyles1 from "./shared-ui.module.css";

type HarborBrandProps = {
  compact?: boolean;
  href?: string;
  label?: string;
  ariaLabel?: string;
  onClick?: () => void;
};

export function HarborBrand({
  compact = false,
  href = "#/overview",
  label = "控制台",
  ariaLabel = "Harbor 控制台",
  onClick,
}: HarborBrandProps) {
  const { t } = useLocale();
  return (
    <a
      className={resolveClasses("brand")}
      href={href}
      aria-label={t(ariaLabel)}
      onClick={(event) => {
        if (!onClick) return;
        event.preventDefault();
        onClick();
      }}
    >
      <span
        className={resolveClasses(
          `brand-mark${compact ? " brand-mark-small" : ""}`,
        )}
        aria-hidden="true"
      >
        <img src="/favicon.svg" alt="" />
      </span>
      <span className={resolveClasses("brand-text")}>
        Harbor <b>{t(label)}</b>
      </span>
    </a>
  );
}

const resolveClasses = createClassNames({
  brand: uiStyles0.brand,
  "brand-mark": uiStyles0.brandMark,
  "brand-mark-small": uiStyles0.brandMarkSmall,
  "brand-text": uiStyles0.brandText,
  "harbor-banner-warning": uiStyles1.harborBannerWarning,
  "harbor-banner-success": uiStyles1.harborBannerSuccess,
  "harbor-banner-info": uiStyles1.harborBannerInfo,
  "harbor-banner-danger": uiStyles1.harborBannerDanger,
  clickable: uiStyles1.clickable,
  "overlay-open": uiStyles1.overlayOpen,
  "log-level-trace": uiStyles1.logLevelTrace,
  "log-level-debug": uiStyles1.logLevelDebug,
  "log-level-log": uiStyles1.logLevelLog,
  "log-level-info": uiStyles1.logLevelInfo,
  "log-level-warn": uiStyles1.logLevelWarn,
  "log-level-error": uiStyles1.logLevelError,
  "log-level-fatal": uiStyles1.logLevelFatal,
});
