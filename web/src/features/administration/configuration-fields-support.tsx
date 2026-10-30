import type {
  HarborConfiguration,
  HarborConfigurationItem,
} from "../../app/models";

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

export function addEditable({
  payload,
  configuration,
  key,
  value,
  skipEmpty = false,
}: {
  payload: ConfigurationPayload;
  configuration: HarborConfiguration;
  key: string;
  value: boolean | number | string;
  skipEmpty?: boolean;
}) {
  if (!configurationEditable(configuration, key)) return;
  if (skipEmpty && String(value).trim() === "") return;
  payload[key] = value;
}
