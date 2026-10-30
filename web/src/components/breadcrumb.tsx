import { Fragment } from "react";
import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import { Icon } from "./icon";
import uiStyles0 from "./shared-ui.module.css";

type BreadcrumbProps = {
  items: { label: string; href?: string }[];
};

export function Breadcrumb({ items }: BreadcrumbProps) {
  const { t } = useLocale();
  return (
    <nav className={resolveClasses("breadcrumb")} aria-label={t("面包屑")}>
      {items.map((item, index) => (
        <Fragment key={`${item.label}-${String(index)}`}>
          {index > 0 ? <Icon name="chevron" /> : null}
          {item.href ? (
            <a href={item.href}>{t(item.label)}</a>
          ) : (
            <span>{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  breadcrumb: uiStyles0.breadcrumb,
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
