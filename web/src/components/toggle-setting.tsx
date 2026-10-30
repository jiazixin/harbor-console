import { createClassNames } from "../lib/css/class-names";
import { FormInput } from "./form-input";
import uiStyles0 from "./shared-ui.module.css";
type ToggleSettingProps = {
  name: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function ToggleSetting({
  name,
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: ToggleSettingProps) {
  return (
    <label className={resolveClasses("toggle-setting")}>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <FormInput
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.currentTarget.checked);
        }}
      />
      <i />
    </label>
  );
}

const resolveClasses = createClassNames({
  "toggle-setting": uiStyles0.toggleSetting,
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
