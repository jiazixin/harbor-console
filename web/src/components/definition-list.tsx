import type { ReactNode } from "react";
import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./shared-ui.module.css";

type DefinitionListProps = {
  rows: { label: ReactNode; value: ReactNode; title?: string }[];
};

export function DefinitionList({ rows }: DefinitionListProps) {
  return (
    <dl className={resolveClasses("definition-list")}>
      {rows.map((row, index) => (
        <div key={String(index)}>
          <dt>{row.label}</dt>
          <dd title={row.title}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const resolveClasses = createClassNames({
  "definition-list": uiStyles0.definitionList,
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
