import { useState } from "react";

import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type {
  PreheatFilter,
  PreheatPolicy,
  PreheatProvider,
  PreheatTrigger,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { UnifiedSelect } from "../../components/unified-select";

function parseJson<T>(value: string | T | undefined, fallback: T): T {
  if (value !== undefined && typeof value !== "string") return value;
  try {
    return JSON.parse(typeof value === "string" ? value : "") as T;
  } catch {
    return fallback;
  }
}

function filterValue(
  policy: PreheatPolicy | undefined,
  type: string,
  fallback = "",
) {
  const value = parseJson<PreheatFilter[]>(policy?.filters, []).find(
    (filter) => filter.type === type,
  )?.value;
  const text = value ?? fallback;
  return /^\{.*\}$/.test(text) ? text.slice(1, -1) : text;
}

function patternValue(value: string): string {
  const normalized = value.trim();
  return normalized.includes(",") && !/^\{.*\}$/.test(normalized)
    ? `{${normalized}}`
    : normalized;
}

function stringField(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function policyPayload(
  projectId: number,
  policy: PreheatPolicy | undefined,
  fields: {
    providerId: string;
    name: string;
    description: string;
    repository: string;
    tag: string;
    label: string;
    triggerType: string;
    cron: string;
    scope: string;
    clusterIds: string;
    enabled: boolean;
  },
) {
  const filters: PreheatFilter[] = [
    { type: "repository", value: patternValue(fields.repository) },
    { type: "tag", value: patternValue(fields.tag) },
  ];
  const label = patternValue(fields.label);
  if (label) filters.push({ type: "label", value: label });
  const extra: Record<string, unknown> = {};
  if (fields.scope) extra.scope = fields.scope;
  const clusterIds = fields.clusterIds
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  if (clusterIds.length) extra.cluster_ids = clusterIds;
  return {
    ...(policy?.id ? { id: policy.id } : {}),
    name: fields.name.trim(),
    description: fields.description.trim(),
    project_id: projectId,
    provider_id: Number(fields.providerId),
    filters: JSON.stringify(filters),
    trigger: JSON.stringify({
      type: fields.triggerType,
      trigger_setting: {
        cron: fields.triggerType === "scheduled" ? fields.cron.trim() : "",
      },
    }),
    enabled: fields.enabled,
    ...(Object.keys(extra).length
      ? { extra_attrs: JSON.stringify(extra) }
      : {}),
  };
}

function runnablePolicyPayload(policy: PreheatPolicy) {
  const payload: Record<string, unknown> = {
    name: policy.name,
    description: policy.description ?? "",
    project_id: policy.project_id ?? 0,
    provider_id: policy.provider_id ?? 0,
    filters:
      typeof policy.filters === "string"
        ? policy.filters
        : JSON.stringify(policy.filters ?? []),
    trigger:
      typeof policy.trigger === "string"
        ? policy.trigger
        : JSON.stringify(policy.trigger ?? {}),
    enabled: policy.enabled !== false,
  };
  if (policy.id > 0) payload.id = policy.id;
  if (typeof policy.extra_attrs === "string" && policy.extra_attrs.trim()) {
    payload.extra_attrs = policy.extra_attrs;
  } else if (policy.extra_attrs && typeof policy.extra_attrs === "object") {
    payload.extra_attrs = JSON.stringify(policy.extra_attrs);
  }
  return payload;
}

export function PreheatPolicyDialog({
  project,
  projectId,
  providers,
  policy,
  onClose,
  onSaved,
}: {
  project: string;
  projectId: number;
  providers: PreheatProvider[];
  policy?: PreheatPolicy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { locale, t } = useLocale();
  const trigger = parseJson<PreheatTrigger>(policy?.trigger, {
    type: "manual",
    trigger_setting: { cron: "" },
  });
  const extra = parseJson<Record<string, unknown>>(policy?.extra_attrs, {});
  const defaultProvider =
    policy?.provider_id ??
    providers.find((provider) => provider.default)?.id ??
    providers[0]?.id;
  const [providerId, setProviderId] = useState(String(defaultProvider));
  const [name, setName] = useState(policy?.name ?? "");
  const [description, setDescription] = useState(policy?.description ?? "");
  const [repository, setRepository] = useState(
    filterValue(policy, "repository", "**"),
  );
  const [tag, setTag] = useState(filterValue(policy, "tag", "**"));
  const [label, setLabel] = useState(filterValue(policy, "label"));
  const [triggerType, setTriggerType] = useState(trigger.type ?? "manual");
  const [cron, setCron] = useState(
    trigger.trigger_setting?.cron ?? "0 0 2 * * *",
  );
  const [scope, setScope] = useState(
    stringField(extra.scope, "single_seed_peer"),
  );
  const [clusterIds, setClusterIds] = useState(
    Array.isArray(extra.cluster_ids) ? extra.cluster_ids.join(",") : "",
  );
  const [enabled, setEnabled] = useState(policy?.enabled !== false);
  const selectedProvider = providers.find(
    (provider) => String(provider.id) === providerId,
  );
  const dragonfly =
    selectedProvider?.provider?.startsWith("dragonfly") ?? false;
  return (
    <ControlDialog
      title={policy ? "编辑预热策略" : "新建预热策略"}
      subtitle={project}
      submitLabel={policy ? "保存策略" : "创建策略"}
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          policy ? "preheat-policy" : "preheat-policies",
          policy ? { project, name: policy.name } : { project },
          policy ? "PUT" : "POST",
          policyPayload(projectId, policy, {
            providerId,
            name,
            description,
            repository,
            tag,
            label,
            triggerType,
            cron,
            scope: dragonfly ? scope : "",
            clusterIds: dragonfly ? clusterIds : "",
            enabled,
          }),
        );
        onSaved();
      }}
    >
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("Provider 实例")}</span>
          <UnifiedSelect
            ariaLabel={t("Provider 实例")}
            name="provider_id"
            value={providerId}
            options={providers.map((provider) => ({
              value: String(provider.id),
              label: `${provider.provider ?? `#${String(provider.id)}`}${provider.default ? (locale === "en-US" ? " (default)" : "（默认）") : ""}`,
            }))}
            onChange={setProviderId}
          />
        </label>
        <label className="field">
          <span>{t("策略名称")}</span>
          <input
            required
            maxLength={255}
            pattern="[A-Za-z0-9]+([._\-][A-Za-z0-9]+)*"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label className="field field-span">
          <span>{t("描述")}</span>
          <input
            maxLength={1024}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span>{t("仓库筛选")}</span>
          <input
            required
            value={repository}
            onChange={(event) => setRepository(event.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span>{t("Tag 筛选")}</span>
          <input
            required
            value={tag}
            onChange={(event) => setTag(event.currentTarget.value)}
          />
        </label>
        <label className="field field-span">
          <span>{t("标签筛选")}</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.currentTarget.value)}
            placeholder={t("可选；多个标签用逗号分隔")}
          />
        </label>
        <label className="field">
          <span>{t("触发方式")}</span>
          <UnifiedSelect
            ariaLabel={t("触发方式")}
            name="trigger"
            value={triggerType}
            options={[
              { value: "manual", label: t("手动") },
              { value: "scheduled", label: t("定时") },
              { value: "event_based", label: t("制品推送事件") },
            ]}
            onChange={setTriggerType}
          />
        </label>
        {triggerType === "scheduled" ? (
          <label className="field">
            <span>{t("Cron 表达式")}</span>
            <input
              required
              value={cron}
              onChange={(event) => setCron(event.currentTarget.value)}
            />
            <small className="field-help">
              {t("Harbor 使用含秒字段的 Cron 表达式。")}
            </small>
          </label>
        ) : null}
        {dragonfly ? (
          <>
            <label className="field">
              <span>{t("Dragonfly 分发范围")}</span>
              <UnifiedSelect
                ariaLabel={t("Dragonfly 分发范围")}
                name="scope"
                value={scope}
                options={[
                  { value: "single_seed_peer", label: t("单个 Seed Peer") },
                  { value: "all_seed_peers", label: t("全部 Seed Peer") },
                  { value: "all_peers", label: t("全部 Peer") },
                ]}
                onChange={setScope}
              />
            </label>
            <label className="field">
              <span>{t("Dragonfly 集群 ID")}</span>
              <input
                value={clusterIds}
                onChange={(event) => setClusterIds(event.currentTarget.value)}
                placeholder="1,2,3"
              />
            </label>
          </>
        ) : null}
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.currentTarget.checked)}
        />
        <span>
          <strong>{t("启用预热策略")}</strong>
          <small>{t("停用后保留配置但不再触发新任务")}</small>
        </span>
      </label>
    </ControlDialog>
  );
}

export function DeletePreheatPolicyDialog({
  project,
  policy,
  onClose,
  onDeleted,
}: {
  project: string;
  policy: PreheatPolicy;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  return (
    <ControlDialog
      title="删除预热策略"
      subtitle={
        locale === "en-US"
          ? `Policy ${policy.name} and its execution history entry will be deleted.`
          : `策略 ${policy.name} 及其执行记录入口将被删除。`
      }
      submitLabel="删除策略"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "preheat-policy",
          { project, name: policy.name },
          "DELETE",
        );
        onDeleted();
      }}
    >
      <div className="notice notice-danger">{t("删除后无法恢复。")}</div>
    </ControlDialog>
  );
}

export function RunPreheatPolicyDialog({
  project,
  policy,
  onClose,
  onStarted,
}: {
  project: string;
  policy: PreheatPolicy;
  onClose: () => void;
  onStarted: () => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="立即执行 P2P 预热"
      subtitle={policy.name}
      submitLabel="开始预热"
      submitIcon="play"
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "preheat-policy",
          { project, name: policy.name },
          "POST",
          runnablePolicyPayload(policy),
        );
        onStarted();
      }}
    >
      <div className="notice notice-info">
        <span>
          {t("Harbor 将按当前仓库、Tag 与标签筛选条件创建预热任务。")}
        </span>
      </div>
    </ControlDialog>
  );
}
