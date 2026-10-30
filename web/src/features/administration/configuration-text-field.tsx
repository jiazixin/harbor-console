import { useLocale } from "../../app/locale-context";
import type { HarborConfiguration } from "../../app/models";
import { FormInput } from "../../components/form-input";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

import {
  configurationEditable,
  configurationString,
} from "./configuration-fields-support";

type ConfigurationTextFieldProps = {
  configuration: HarborConfiguration;
  configKey: string;
  label: string;
  type?: "number" | "password" | "text" | "url";
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  value?: string | number;
  disabled?: boolean;
  className?: string;
};

export function ConfigurationTextField({
  configuration,
  configKey,
  label,
  type = "text",
  required = false,
  min,
  max,
  placeholder,
  value,
  disabled = false,
  className,
}: ConfigurationTextFieldProps) {
  const { t } = useLocale();
  const locked = !configurationEditable(configuration, configKey);
  return (
    <label
      className={resolveClasses(`field${className ? ` ${className}` : ""}`)}
    >
      <span>{t(label)}</span>
      <FormInput
        name={configKey}
        type={type}
        required={required}
        min={min}
        max={max}
        step={type === "number" ? 1 : undefined}
        placeholder={placeholder ? t(placeholder) : undefined}
        defaultValue={
          value ?? configurationString(configuration, configKey, "")
        }
        disabled={locked || disabled}
        data-config-locked={locked ? "true" : undefined}
      />
    </label>
  );
}

const resolveClasses = createClassNames({
  field: uiStyles0.field,
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
