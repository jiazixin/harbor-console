import type {
  ReplicationAdapterInfo,
  ReplicationFilter,
  ReplicationPolicy,
} from "../../app/models";

export type ReplicationDirection = "pull" | "push";
export type TriggerType = "event_based" | "manual" | "scheduled";
export type FilterDecoration = "excludes" | "matches";

export const defaultCapability: ReplicationAdapterInfo = {
  type: "registry",
  supported_resource_filters: [
    { type: "name", style: "input", values: [] },
    { type: "tag", style: "input", values: [] },
    { type: "resource", style: "radio", values: ["image"] },
  ],
  supported_triggers: ["manual", "scheduled"],
  supported_copy_by_chunk: false,
};

export function policyDirection(
  policy?: ReplicationPolicy,
): ReplicationDirection {
  return (policy?.dest_registry?.id ?? 0) > 0 ? "push" : "pull";
}

export function filterMap(filters: ReplicationFilter[] = []) {
  return new Map(filters.map((filter) => [filter.type ?? "", filter]));
}

export function filterString(
  filters: Map<string, ReplicationFilter>,
  type: string,
): string {
  const value = filters.get(type)?.value;
  return typeof value === "string" ? value : "";
}

export function filterDecoration(
  filters: Map<string, ReplicationFilter>,
  type: string,
): FilterDecoration {
  return filters.get(type)?.decoration === "excludes" ? "excludes" : "matches";
}

export function filterLabels(
  filters: Map<string, ReplicationFilter>,
): string[] {
  const value = filters.get("label")?.value;
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}

export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
