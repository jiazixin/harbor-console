import type { ReactNode } from "react";
import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./execution-section.module.css";
import uiStyles1 from "./shared-ui.module.css";

/** A titled list inside an execution dialog, such as its tasks. */
type ExecutionSectionProps = {
  title: string;
  summary: string;
  children: ReactNode;
};

export function ExecutionSection({
  title,
  summary,
  children,
}: ExecutionSectionProps) {
  const { t } = useLocale();
  return (
    <section className={resolveClasses("replication-task-section")}>
      <div className={resolveClasses("section-heading compact-heading")}>
        <div>
          <h3>{t(title)}</h3>
          <p>{summary}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const resolveClasses = createClassNames({
  "replication-task-section": uiStyles0.replicationTaskSection,
  "section-heading": uiStyles1.sectionHeading,
  "compact-heading": uiStyles1.compactHeading,
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
