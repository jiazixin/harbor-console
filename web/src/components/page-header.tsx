import { type ReactNode } from "react";
import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./shared-ui.module.css";

type PageHeaderProps = {
  title: string;
  subtitle: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: PageHeaderProps) {
  const { t } = useLocale();
  const translatedTitle = t(title);
  return (
    <header className={resolveClasses("page-header")}>
      <div>
        {breadcrumb}
        <h1 title={translatedTitle}>{translatedTitle}</h1>
        <p>{subtitle}</p>
      </div>
      {actions ? (
        <div className={resolveClasses("page-actions")}>{actions}</div>
      ) : null}
    </header>
  );
}

const resolveClasses = createClassNames({
  "page-header": uiStyles0.pageHeader,
  "page-actions": uiStyles0.pageActions,
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
