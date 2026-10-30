import { createClassNames } from "../lib/css/class-names";
import uiStyles0 from "./shared-ui.module.css";

import { Icon } from "./icon";

type ViewMode = "card" | "list";

type ViewModeToggleProps = {
  value: ViewMode;
  ariaLabel: string;
  listLabel: string;
  cardLabel: string;
  onChange: (mode: ViewMode) => void;
};

export function ViewModeToggle({
  value,
  ariaLabel,
  listLabel,
  cardLabel,
  onChange,
}: ViewModeToggleProps) {
  return (
    <div
      className={resolveClasses("view-mode-toggle")}
      role="group"
      aria-label={ariaLabel}
    >
      {(["list", "card"] as const).map((mode) => {
        const label = mode === "list" ? listLabel : cardLabel;
        return (
          <button
            key={mode}
            type="button"
            className={resolveClasses(value === mode ? "active" : "")}
            title={label}
            aria-label={label}
            aria-pressed={value === mode}
            onClick={() => {
              onChange(mode);
            }}
          >
            <Icon name={mode === "list" ? "list" : "grid"} />
          </button>
        );
      })}
    </div>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "view-mode-toggle": uiStyles0.viewModeToggle,
  button: uiStyles0.button,
  active: uiStyles0.active,
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
