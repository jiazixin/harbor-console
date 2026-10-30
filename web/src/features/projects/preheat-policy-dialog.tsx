import { useState } from "react";
import { useLocale } from "../../app/locale-context";
import type {
  PreheatFilter,
  PreheatPolicy,
  PreheatProvider,
} from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { preheatExtra, preheatFilters, preheatTrigger } from "./preheat-schema";
import { affectedQueries } from "./project-preheat-dialogs-support";

function filterValue(
  policy: PreheatPolicy | undefined,
  type: string,
  fallback = "",
) {
  const value = preheatFilters(policy?.filters).find(
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

type PreheatPolicyDialogProps = {
  project: string;
  projectId: number;
  providers: PreheatProvider[];
  policy?: PreheatPolicy;
  onClose: () => void;
  onSaved: () => void;
};

export function PreheatPolicyDialog({
  project,
  projectId,
  providers,
  policy,
  onClose,
  onSaved,
}: PreheatPolicyDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const trigger = preheatTrigger(policy?.trigger);
  const extra = preheatExtra(policy?.extra_attrs);
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
        await mutate({
          operation: policy ? "preheat-policy" : "preheat-policies",
          parameters: policy ? { project, name: policy.name } : { project },
          method: policy ? "PUT" : "POST",
          payload: policyPayload(projectId, policy, {
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
        });
        onSaved();
      }}
    >
      <div className={resolveClasses("form-grid two-columns")}>
        <label className={resolveClasses("field")}>
          <span>{t("Provider 实例")}</span>
          <UnifiedSelect
            ariaLabel={t("Provider 实例")}
            name="provider_id"
            value={providerId}
            options={providers.map((provider) => ({
              value: String(provider.id),
              label: `${provider.provider ?? `#${String(provider.id)}`}${(() => {
                if (provider.default) {
                  if (locale === "en-US") {
                    return " (default)";
                  }
                  return "（默认）";
                }
                return "";
              })()}`,
            }))}
            onChange={setProviderId}
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("策略名称")}</span>
          <FormInput
            required
            maxLength={255}
            pattern="[A-Za-z0-9]+([._\-][A-Za-z0-9]+)*"
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field field-span")}>
          <span>{t("描述")}</span>
          <FormInput
            maxLength={1024}
            value={description}
            onChange={(event) => {
              setDescription(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("仓库筛选")}</span>
          <FormInput
            required
            value={repository}
            onChange={(event) => {
              setRepository(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("Tag 筛选")}</span>
          <FormInput
            required
            value={tag}
            onChange={(event) => {
              setTag(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field field-span")}>
          <span>{t("标签筛选")}</span>
          <FormInput
            value={label}
            onChange={(event) => {
              setLabel(event.currentTarget.value);
            }}
            placeholder={t("可选；多个标签用逗号分隔")}
          />
        </label>
        <label className={resolveClasses("field")}>
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
          <label className={resolveClasses("field")}>
            <span>{t("Cron 表达式")}</span>
            <FormInput
              required
              value={cron}
              onChange={(event) => {
                setCron(event.currentTarget.value);
              }}
            />
            <small className={resolveClasses("field-help")}>
              {t("Harbor 使用含秒字段的 Cron 表达式。")}
            </small>
          </label>
        ) : null}
        {dragonfly ? (
          <>
            <label className={resolveClasses("field")}>
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
            <label className={resolveClasses("field")}>
              <span>{t("Dragonfly 集群 ID")}</span>
              <FormInput
                value={clusterIds}
                onChange={(event) => {
                  setClusterIds(event.currentTarget.value);
                }}
                placeholder="1,2,3"
              />
            </label>
          </>
        ) : null}
      </div>
      <label className={resolveClasses("check-row")}>
        <FormInput
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            setEnabled(event.currentTarget.checked);
          }}
        />
        <span>
          <strong>{t("启用预热策略")}</strong>
          <small>{t("停用后保留配置但不再触发新任务")}</small>
        </span>
      </label>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  "unified-select": uiStyles0.unifiedSelect,
  tag: uiStyles0.tag,
  "form-grid": uiStyles0.formGrid,
  "two-columns": uiStyles0.twoColumns,
  field: uiStyles0.field,
  "field-span": uiStyles0.fieldSpan,
  "field-help": uiStyles0.fieldHelp,
  "check-row": uiStyles0.checkRow,
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
