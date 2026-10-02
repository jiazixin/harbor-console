import { useMemo, useState } from "react";

import { useLocale } from "../../app/locale-context";
import type {
  ProjectLabel,
  Registry,
  ReplicationAdapterInfo,
  ReplicationFilter,
  ReplicationPolicy,
} from "../../app/models";

import {
  policyDirection,
  filterMap,
  filterString,
  filterDecoration,
  filterLabels,
  formString,
  type ReplicationDirection,
  type TriggerType,
  type FilterDecoration,
} from "./replication-policy-form";
import { useReplicationCapabilities } from "./use-replication-capabilities";
export function useReplicationPolicyForm({
  policy,
  registries,
  labels,
  localInfo,
}: {
  policy?: ReplicationPolicy;
  registries: Registry[];
  labels: ProjectLabel[];
  localInfo?: ReplicationAdapterInfo;
}) {
  const { locale, t } = useLocale();
  const existingFilters = useMemo(
    () => filterMap(policy?.filters),
    [policy?.filters],
  );
  const initialDirection = policy ? policyDirection(policy) : "push";
  const initialRegistry =
    initialDirection === "push"
      ? policy?.dest_registry?.id
      : policy?.src_registry?.id;
  const initialSpeed = policy?.speed && policy.speed > 0 ? policy.speed : -1;
  const speedInMbps = initialSpeed >= 1024 && initialSpeed % 1024 === 0;
  const [speedUnit, setSpeedUnit] = useState<"Kbps" | "Mbps">(
    speedInMbps ? "Mbps" : "Kbps",
  );
  const [direction, setDirection] =
    useState<ReplicationDirection>(initialDirection);
  const [registryId, setRegistryId] = useState(
    String(initialRegistry ?? registries[0]?.id ?? ""),
  );
  const [enabled, setEnabled] = useState(
    policy ? policy.enabled === true : true,
  );
  const [trigger, setTrigger] = useState<TriggerType>(
    (policy?.trigger?.type as TriggerType | undefined) ?? "manual",
  );
  const [namespace, setNamespace] = useState(policy?.dest_namespace ?? "");
  const [replaceCount, setReplaceCount] = useState(
    String(policy?.dest_namespace_replace_count ?? 1),
  );
  const [nameFilter, setNameFilter] = useState(
    filterString(existingFilters, "name"),
  );
  const [tagFilter, setTagFilter] = useState(
    filterString(existingFilters, "tag"),
  );
  const [tagDecoration, setTagDecoration] = useState<FilterDecoration>(
    filterDecoration(existingFilters, "tag"),
  );
  const [resourceFilter, setResourceFilter] = useState(
    filterString(existingFilters, "resource"),
  );
  const [selectedLabels, setSelectedLabels] = useState(
    filterLabels(existingFilters),
  );
  const [labelDecoration, setLabelDecoration] = useState<FilterDecoration>(
    filterDecoration(existingFilters, "label"),
  );
  const [replicateDeletion, setReplicateDeletion] = useState(
    Boolean(policy?.replicate_deletion),
  );
  const [singleActive, setSingleActive] = useState(
    Boolean(policy?.single_active_replication),
  );
  const [override, setOverride] = useState(
    policy ? Boolean(policy.override) : true,
  );
  const [copyByChunk, setCopyByChunk] = useState(
    Boolean(policy?.copy_by_chunk),
  );
  const { capability, remoteInfo, capabilityError, capabilityReady } =
    useReplicationCapabilities({
      direction,
      initialDirection,
      localInfo,
      registryId,
      setTrigger,
      setCopyByChunk,
    });

  const filterStyles = (capability.supported_resource_filters ?? []).filter(
    (style) => ["label", "name", "resource", "tag"].includes(style.type ?? ""),
  );
  const triggerOptions = (capability.supported_triggers ?? [])
    .filter((value): value is TriggerType =>
      ["event_based", "manual", "scheduled"].includes(value),
    )
    .concat(!capability.supported_triggers?.includes(trigger) ? [trigger] : []);
  const uniqueTriggerOptions = [
    ...new Set(triggerOptions.length ? triggerOptions : ["manual"]),
  ] as TriggerType[];
  const labelCandidates = useMemo(() => {
    const candidates = new Map<string, { color: string; name: string }>();
    labels.forEach((label) =>
      candidates.set(label.name, {
        color: label.color ?? "#7b7b82",
        name: label.name,
      }),
    );
    const allowed = capability.supported_resource_filters?.find(
      (style) => style.type === "label",
    )?.values;
    [...(allowed ?? []), ...selectedLabels].forEach((name) => {
      if (!candidates.has(name))
        candidates.set(name, { color: "#7b7b82", name });
    });
    return [...candidates.values()];
  }, [capability.supported_resource_filters, labels, selectedLabels]);

  function buildFilters(): ReplicationFilter[] {
    const filters: ReplicationFilter[] = [];
    if (nameFilter.trim())
      filters.push({ type: "name", value: nameFilter.trim() });
    if (tagFilter.trim())
      filters.push({
        type: "tag",
        value: tagFilter.trim(),
        decoration: tagDecoration,
      });
    if (selectedLabels.length)
      filters.push({
        type: "label",
        value: selectedLabels,
        decoration: labelDecoration,
      });
    if (resourceFilter)
      filters.push({ type: "resource", value: resourceFilter });
    return filters;
  }

  function createPayload(formData: FormData) {
    const speedValue = Number(formData.get("speed"));
    if (!Number.isInteger(speedValue) || speedValue === 0 || speedValue < -1)
      throw new Error(t("带宽必须是 -1 或正整数"));
    const speed =
      speedUnit === "Mbps" && speedValue > 0 ? speedValue * 1024 : speedValue;
    if (speed > 2147483647) throw new Error(t("带宽超出 Harbor 支持范围"));
    const registry = { id: Number(registryId) };
    const payload: Record<string, unknown> = {
      name: formString(formData, "name"),
      description: formString(formData, "description"),
      src_registry: direction === "pull" ? registry : null,
      dest_registry: direction === "push" ? registry : null,
      dest_namespace: namespace.trim(),
      dest_namespace_replace_count: Number(replaceCount),
      trigger: {
        type: trigger,
        trigger_settings:
          trigger === "scheduled" ? { cron: formString(formData, "cron") } : {},
      },
      filters: buildFilters(),
      enabled,
      override,
      replicate_deletion:
        direction === "push" && trigger === "event_based" && replicateDeletion,
      speed,
      single_active_replication: trigger !== "event_based" && singleActive,
    };
    if (remoteInfo.supported_copy_by_chunk) payload.copy_by_chunk = copyByChunk;
    return payload;
  }
  return {
    locale,
    t,
    initialSpeed,
    speedInMbps,
    speedUnit,
    setSpeedUnit,
    direction,
    setDirection,
    registryId,
    setRegistryId,
    enabled,
    setEnabled,
    trigger,
    setTrigger,
    namespace,
    setNamespace,
    replaceCount,
    setReplaceCount,
    nameFilter,
    setNameFilter,
    tagFilter,
    setTagFilter,
    tagDecoration,
    setTagDecoration,
    resourceFilter,
    setResourceFilter,
    selectedLabels,
    setSelectedLabels,
    labelDecoration,
    setLabelDecoration,
    replicateDeletion,
    setReplicateDeletion,
    singleActive,
    setSingleActive,
    override,
    setOverride,
    copyByChunk,
    setCopyByChunk,
    capability,
    remoteInfo,
    capabilityError,
    capabilityReady,
    filterStyles,
    uniqueTriggerOptions,
    labelCandidates,
    createPayload,
  };
}
