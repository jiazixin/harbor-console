import type { ReactNode } from "react";
import { useState } from "react";

import { useLocale } from "../../app/locale-context";
import type {
  HarborConfiguration,
  HarborConfigurationItem,
} from "../../app/models";
import { Icon } from "../../components/icons";
import { ToggleSetting } from "../../components/toggle-setting";
import { UnifiedSelect } from "../../components/unified-select";

/** The fields sent to Harbor's PUT /configurations. */
export type ConfigurationPayload = Record<string, boolean | number | string>;

function configurationItem(
  configuration: HarborConfiguration,
  key: string,
): HarborConfigurationItem | undefined {
  const value = configuration[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : undefined;
}

export function configurationValue(
  configuration: HarborConfiguration,
  key: string,
): unknown {
  const item = configurationItem(configuration, key);
  return item && Object.hasOwn(item, "value") ? item.value : configuration[key];
}

export function configurationEditable(
  configuration: HarborConfiguration,
  key: string,
): boolean {
  return configurationItem(configuration, key)?.editable !== false;
}

export function configurationString(
  configuration: HarborConfiguration,
  key: string,
  fallback = "",
): string {
  const value = configurationValue(configuration, key);
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number")
    return String(value);
  return fallback;
}

export function configurationBoolean(
  configuration: HarborConfiguration,
  key: string,
): boolean {
  return Boolean(configurationValue(configuration, key));
}

export function formString(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function addEditable(
  payload: ConfigurationPayload,
  configuration: HarborConfiguration,
  key: string,
  value: boolean | number | string,
  skipEmpty = false,
) {
  if (!configurationEditable(configuration, key)) return;
  if (skipEmpty && String(value).trim() === "") return;
  payload[key] = value;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
}: {
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
}) {
  const { t } = useLocale();
  const locked = !configurationEditable(configuration, configKey);
  return (
    <label className={`field${className ? ` ${className}` : ""}`}>
      <span>{t(label)}</span>
      <input
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

export function ConfigurationScopeField({
  configuration,
  configKey,
  label,
}: {
  configuration: HarborConfiguration;
  configKey: string;
  label: string;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState(
    configurationString(configuration, configKey, "0"),
  );
  return (
    <label className="field">
      <span>{t(label)}</span>
      <UnifiedSelect
        ariaLabel={t(label)}
        name={configKey}
        value={value}
        disabled={!configurationEditable(configuration, configKey)}
        options={[
          { value: "0", label: "Base" },
          { value: "1", label: t("单层") },
          { value: "2", label: t("子树") },
        ]}
        onChange={setValue}
      />
    </label>
  );
}

export function ConfigurationToggle({
  configuration,
  configKey,
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  configuration: HarborConfiguration;
  configKey: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  return (
    <ToggleSetting
      name={configKey}
      title={t(title)}
      description={t(description)}
      checked={checked}
      disabled={disabled || !configurationEditable(configuration, configKey)}
      onChange={onChange}
    />
  );
}

export function ConfigurationGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <section className="configuration-group">
      <div className="configuration-group-head">
        <h3>{t(title)}</h3>
        <p>{t(description)}</p>
      </div>
      {children}
    </section>
  );
}

/** The heading of a configuration form with its action buttons. */
export function ConfigurationFormHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div className="section-heading">
      <div>
        <h2>{t(title)}</h2>
        <p>{t(description)}</p>
      </div>
      {children}
    </div>
  );
}

export function ConfigurationSaveButton({
  busy,
  label,
}: {
  busy: boolean;
  label: string;
}) {
  const { t } = useLocale();
  return (
    <button
      className="button button-small button-primary"
      type="submit"
      disabled={busy}
    >
      {busy ? (
        <span className="spinner button-spinner" aria-hidden="true" />
      ) : (
        <Icon name="check" />
      )}
      <span>{t(busy ? "正在保存" : label)}</span>
    </button>
  );
}
