import type { ReactNode } from "react";
import { useLocale } from "../../app/locale-context";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

/** The heading of a configuration form with its action buttons. */
type ConfigurationFormHeaderProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function ConfigurationFormHeader({
  title,
  description,
  children,
}: ConfigurationFormHeaderProps) {
  const { t } = useLocale();
  return (
    <div className={resolveClasses("section-heading")}>
      <div>
        <h2>{t(title)}</h2>
        <p>{t(description)}</p>
      </div>
      {children}
    </div>
  );
}

const resolveClasses = createClassNames({
  "section-heading": uiStyles0.sectionHeading,
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
