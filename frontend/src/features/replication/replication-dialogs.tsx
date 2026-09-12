import { useEffect, useMemo, useRef, useState } from "react";

import { controlApi } from "../../app/api-client";
import { downloadText } from "../../app/download-text";
import { formatDate, formatDuration, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  ProjectLabel,
  Registry,
  ReplicationAdapterInfo,
  ReplicationExecution,
  ReplicationFilter,
  ReplicationPolicy,
  ReplicationTask,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import {
  LogTimezoneControl,
  StructuredLog,
  type LogTimezone,
} from "../../components/structured-log";
import { StatusBadge, triggerLabel } from "../../components/status-badge";
import { UnifiedSelect } from "../../components/unified-select";

type ReplicationDirection = "pull" | "push";
type TriggerType = "event_based" | "manual" | "scheduled";
type FilterDecoration = "excludes" | "matches";

const defaultCapability: ReplicationAdapterInfo = {
  type: "registry",
  supported_resource_filters: [
    { type: "name", style: "input", values: [] },
    { type: "tag", style: "input", values: [] },
    { type: "resource", style: "radio", values: ["image"] },
  ],
  supported_triggers: ["manual", "scheduled"],
  supported_copy_by_chunk: false,
};

function policyDirection(policy?: ReplicationPolicy): ReplicationDirection {
  return (policy?.dest_registry?.id ?? 0) > 0 ? "push" : "pull";
}

function filterMap(filters: ReplicationFilter[] = []) {
  return new Map(filters.map((filter) => [filter.type ?? "", filter]));
}

function filterString(
  filters: Map<string, ReplicationFilter>,
  type: string,
): string {
  const value = filters.get(type)?.value;
  return typeof value === "string" ? value : "";
}

function filterDecoration(
  filters: Map<string, ReplicationFilter>,
  type: string,
): FilterDecoration {
  return filters.get(type)?.decoration === "excludes" ? "excludes" : "matches";
}

function filterLabels(filters: Map<string, ReplicationFilter>): string[] {
  const value = filters.get("label")?.value;
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}

function registryTypeLabel(value: string | undefined): string {
  return (
    {
      harbor: "Harbor",
      "docker-hub": "Docker Hub",
      "docker-registry": "Docker Registry",
      "aws-ecr": "AWS ECR",
      "azure-acr": "Azure ACR",
      "google-gcr": "Google GCR",
      "ali-acr": "阿里云 ACR",
      "huawei-SWR": "华为云 SWR",
      "tencent-tcr": "腾讯云 TCR",
      "volcengine-cr": "火山引擎 CR",
      "github-ghcr": "GitHub GHCR",
      gitlab: "GitLab",
      quay: "Quay",
      "jfrog-artifactory": "JFrog Artifactory",
    }[value ?? ""] ??
    value ??
    "Registry"
  );
}

function filterTypeLabel(type: string): string {
  return (
    {
      name: "仓库名称",
      tag: "Tag",
      label: "全局标签",
      resource: "资源类型",
    }[type] ?? type
  );
}

function filterHelp(type: string): string {
  return (
    {
      name: "支持 * 匹配单层路径、** 匹配多层路径，例如 platform/**。",
      tag: "可匹配或排除 Tag，例如 release-*；留空表示全部 Tag。",
      label: "选择一个或多个全局标签；匹配时需同时满足所选标签。",
      resource: "远端适配器声明的可复制资源类型；留空表示全部类型。",
    }[type] ?? "由当前 Registry Adapter 声明的官方筛选器。"
  );
}

function resourceTypeLabel(value: string | undefined): string {
  return (
    {
      image: "镜像",
      artifact: "制品",
      repository: "仓库",
      project: "项目",
    }[value?.toLowerCase() ?? ""] ??
    value ??
    "其他"
  );
}

function operationLabel(value: string | undefined): string {
  return (
    {
      copy: "复制",
      delete: "删除",
      pull: "拉取",
      push: "推送",
    }[value?.toLowerCase() ?? ""] ??
    value ??
    "-"
  );
}

function executionStatusLabel(value: string | undefined): string {
  return (
    {
      inprogress: "进行中",
      in_progress: "进行中",
      succeed: "成功",
      success: "成功",
      failed: "失败",
      stopped: "已停止",
    }[value?.toLowerCase() ?? ""] ??
    value ??
    "未知"
  );
}

function replicationTaskDate(
  value: string | undefined,
  locale: "en-US" | "zh-CN",
): string {
  return value
    ? formatDate(value, locale)
    : locale === "en-US"
      ? "None"
      : "暂无";
}

function capabilitySummary(
  info: ReplicationAdapterInfo,
  locale: "en-US" | "zh-CN",
  t: (value: string) => string,
) {
  const filters = (info.supported_resource_filters ?? []).map((item) => {
    if (!item.type) return "";
    return locale === "en-US"
      ? {
          name: "repository name",
          tag: "tag",
          resource: "resource type",
          label: "global labels",
        }[item.type]
      : filterTypeLabel(item.type);
  });
  const triggers = (info.supported_triggers ?? []).map((value) =>
    locale === "en-US"
      ? ({
          manual: "manual",
          scheduled: "scheduled",
          event_based: "event-based",
        }[value] ?? value)
      : ({ manual: "手动", scheduled: "定时", event_based: "事件" }[value] ??
        value),
  );
  const separator = locale === "en-US" ? ", " : "、";
  return `${info.type ?? "Registry Adapter"} · ${filters.length ? filters.join(separator) : t("无筛选器")} · ${triggers.length ? triggers.join(separator) : t("无触发器")}`;
}

function logText(value: unknown): string {
  return typeof value === "string"
    ? value
    : JSON.stringify(value ?? "", null, 2);
}

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function ReplicationPolicyDialog({
  policy,
  registries,
  labels,
  localInfo,
  onClose,
  onSaved,
}: {
  policy?: ReplicationPolicy;
  registries: Registry[];
  labels: ProjectLabel[];
  localInfo?: ReplicationAdapterInfo;
  onClose: () => void;
  onSaved: () => void;
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
  const [capability, setCapability] = useState<ReplicationAdapterInfo>(
    initialDirection === "push"
      ? (localInfo ?? defaultCapability)
      : defaultCapability,
  );
  const [remoteInfo, setRemoteInfo] =
    useState<ReplicationAdapterInfo>(defaultCapability);
  const [capabilityError, setCapabilityError] = useState("");
  const [capabilityReady, setCapabilityReady] = useState(false);
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
  const firstCapabilityLoad = useRef(true);

  useEffect(() => {
    const controller = new AbortController();
    const remoteId = Number(registryId);
    if (!remoteId) return () => controller.abort();
    setCapabilityReady(false);
    const capabilityPromise =
      direction === "push" && localInfo
        ? Promise.resolve(localInfo)
        : controlApi.data<ReplicationAdapterInfo>(
            "registry-info",
            { id: direction === "push" ? 0 : remoteId },
            controller.signal,
          );
    void Promise.allSettled([
      capabilityPromise,
      controlApi.data<ReplicationAdapterInfo>(
        "registry-info",
        { id: remoteId },
        controller.signal,
      ),
    ]).then((results) => {
      if (controller.signal.aborted) return;
      const nextCapability =
        results[0].status === "fulfilled" && results[0].value
          ? results[0].value
          : defaultCapability;
      const nextRemote =
        results[1].status === "fulfilled" && results[1].value
          ? results[1].value
          : defaultCapability;
      setCapability(nextCapability);
      setRemoteInfo(nextRemote);
      setCapabilityError(
        results
          .filter((result) => result.status === "rejected")
          .map((result) =>
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          )
          .join("；"),
      );
      if (!firstCapabilityLoad.current) {
        const supported = (nextCapability.supported_triggers ?? []).filter(
          (value): value is TriggerType =>
            ["event_based", "manual", "scheduled"].includes(value),
        );
        setTrigger((current) =>
          supported.includes(current) ? current : (supported[0] ?? "manual"),
        );
      }
      firstCapabilityLoad.current = false;
      if (!nextRemote.supported_copy_by_chunk) setCopyByChunk(false);
      setCapabilityReady(true);
    });
    return () => controller.abort();
  }, [direction, localInfo, registryId]);

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

  return (
    <ControlDialog
      title={policy ? "编辑复制策略" : "新建复制策略"}
      subtitle={policy?.name ?? "Harbor v2.15 官方复制策略"}
      submitLabel={policy ? "保存策略" : "创建策略"}
      submitDisabled={!capabilityReady}
      dialogClass="control-dialog-wide"
      onClose={onClose}
      onSubmit={async (formData) => {
        const speedValue = Number(formData.get("speed"));
        if (
          !Number.isInteger(speedValue) ||
          speedValue === 0 ||
          speedValue < -1
        )
          throw new Error(t("带宽必须是 -1 或正整数"));
        const speed =
          speedUnit === "Mbps" && speedValue > 0
            ? speedValue * 1024
            : speedValue;
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
              trigger === "scheduled"
                ? { cron: formString(formData, "cron") }
                : {},
          },
          filters: buildFilters(),
          enabled,
          override,
          replicate_deletion:
            direction === "push" &&
            trigger === "event_based" &&
            replicateDeletion,
          speed,
          single_active_replication: trigger !== "event_based" && singleActive,
        };
        if (remoteInfo.supported_copy_by_chunk)
          payload.copy_by_chunk = copyByChunk;
        await controlApi.mutate(
          policy ? "replication-policy" : "replication-policies",
          policy ? { id: policy.id } : {},
          policy ? "PUT" : "POST",
          payload,
        );
        onSaved();
      }}
    >
      <div className="replication-policy-form">
        {capabilityError ? (
          <div className="warning-banner replication-capability-warning">
            <Icon name="alert" />
            <span>{capabilityError}</span>
          </div>
        ) : null}
        <section className="policy-form-section">
          <header className="policy-section-heading">
            <h3>{t("策略信息")}</h3>
            <p>{t("定义策略名称、状态和用途")}</p>
          </header>
          <div className="policy-section-content form-grid two-columns policy-identity-grid">
            <label className="field">
              <span>{t("策略名称")}</span>
              <input
                name="name"
                required
                maxLength={255}
                defaultValue={policy?.name}
                autoComplete="off"
              />
            </label>
            <label className="toggle-setting policy-status-toggle">
              <span>
                <strong>{t("启用策略")}</strong>
                <small>{t("允许策略按配置的触发方式运行")}</small>
              </span>
              <input
                name="enabled"
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.currentTarget.checked)}
              />
              <i />
            </label>
            <label className="field field-span">
              <span>{t("描述")}</span>
              <textarea
                name="description"
                rows={2}
                maxLength={1024}
                defaultValue={policy?.description ? t(policy.description) : ""}
              />
            </label>
          </div>
        </section>

        <section className="policy-form-section">
          <header className="policy-section-heading">
            <h3>{t("复制规则")}</h3>
            <p>{t("确定资源从哪里来，以及复制到哪里")}</p>
          </header>
          <div className="policy-section-content">
            <div className="policy-form-group">
              <header className="policy-group-heading">
                <h4>{t("来源与范围")}</h4>
                <p>{t("选择复制流向、远端仓库和需要处理的资源")}</p>
              </header>
              <div className="policy-choice-field">
                <span className="policy-field-label">{t("复制方向")}</span>
                <div
                  className="policy-choice-grid policy-direction-choices"
                  role="radiogroup"
                  aria-label={t("复制方向")}
                >
                  {(
                    [
                      ["push", "推送到远端", "本实例作为复制来源"],
                      ["pull", "从远端拉取", "远端仓库作为复制来源"],
                    ] as const
                  ).map(([value, title, description]) => (
                    <label key={value}>
                      <input
                        name="direction"
                        type="radio"
                        value={value}
                        checked={direction === value}
                        onChange={() => setDirection(value)}
                      />
                      <span>
                        <strong>{t(title)}</strong>
                        <small>{t(description)}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-grid two-columns policy-source-grid">
                <label className="field">
                  <span>
                    {t(direction === "push" ? "目标远端仓库" : "来源远端仓库")}
                  </span>
                  <UnifiedSelect
                    name="registry_id"
                    ariaLabel={t(
                      direction === "push" ? "目标远端仓库" : "来源远端仓库",
                    )}
                    value={registryId}
                    options={registries.map((registry) => ({
                      value: String(registry.id),
                      label: `${registry.name ?? `#${String(registry.id ?? "-")}`} · ${t(registryTypeLabel(registry.type))}`,
                    }))}
                    onChange={setRegistryId}
                  />
                </label>
                <div className="policy-flow-preview">
                  <span>{t("复制流向")}</span>
                  <div>
                    <strong>
                      {t(direction === "push" ? "本实例" : "远端仓库")}
                    </strong>
                    <Icon name="arrow-right" />
                    <strong>
                      {t(direction === "push" ? "远端仓库" : "本实例")}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="policy-capability-note">
                <Icon name="info" />
                <p>{capabilitySummary(capability, locale, t)}</p>
              </div>
              <div className="policy-nested-group">
                <header className="policy-nested-heading">
                  <strong>{t("资源筛选")}</strong>
                  <small>
                    {t("按仓库名称、Tag、资源类型或全局标签收窄复制范围")}
                  </small>
                </header>
                <div className="replication-filter-fields">
                  {!filterStyles.length ? (
                    <div className="replication-filter-empty">
                      {t(
                        "当前适配器未声明资源筛选器，将复制其支持的全部资源。",
                      )}
                    </div>
                  ) : (
                    filterStyles.map((style) => {
                      const type = style.type ?? "";
                      return (
                        <div
                          className="replication-filter-row"
                          data-filter-type={type}
                          key={type}
                        >
                          <div>
                            <strong>{t(filterTypeLabel(type))}</strong>
                            <small>{t(filterHelp(type))}</small>
                          </div>
                          <div className="replication-filter-control">
                            {type === "name" ? (
                              <input
                                name="filter_name"
                                value={nameFilter}
                                maxLength={1024}
                                placeholder={t("例如 platform/**")}
                                autoComplete="off"
                                onChange={(event) =>
                                  setNameFilter(event.currentTarget.value)
                                }
                              />
                            ) : type === "tag" ? (
                              <>
                                <UnifiedSelect
                                  name="filter_tag_decoration"
                                  value={tagDecoration}
                                  ariaLabel={t("筛选方式")}
                                  options={[
                                    { value: "matches", label: t("匹配") },
                                    { value: "excludes", label: t("排除") },
                                  ]}
                                  onChange={setTagDecoration}
                                />
                                <input
                                  name="filter_tag"
                                  value={tagFilter}
                                  maxLength={1024}
                                  placeholder={t("例如 release-*")}
                                  autoComplete="off"
                                  onChange={(event) =>
                                    setTagFilter(event.currentTarget.value)
                                  }
                                />
                              </>
                            ) : type === "resource" ? (
                              <UnifiedSelect
                                name="filter_resource"
                                ariaLabel={t("资源类型")}
                                value={resourceFilter}
                                options={[
                                  { value: "", label: t("全部资源") },
                                  ...[
                                    ...new Set([
                                      ...(style.values ?? []),
                                      ...(resourceFilter
                                        ? [resourceFilter]
                                        : []),
                                    ]),
                                  ].map((value) => ({
                                    value,
                                    label: t(resourceTypeLabel(value)),
                                  })),
                                ]}
                                onChange={setResourceFilter}
                              />
                            ) : type === "label" ? (
                              <>
                                <UnifiedSelect
                                  name="filter_label_decoration"
                                  value={labelDecoration}
                                  ariaLabel={t("筛选方式")}
                                  options={[
                                    { value: "matches", label: t("匹配") },
                                    { value: "excludes", label: t("排除") },
                                  ]}
                                  onChange={setLabelDecoration}
                                />
                                {labelCandidates.length ? (
                                  <div className="replication-label-grid">
                                    {labelCandidates.map((label) => (
                                      <label key={label.name}>
                                        <input
                                          type="checkbox"
                                          name="filter_label"
                                          value={label.name}
                                          checked={selectedLabels.includes(
                                            label.name,
                                          )}
                                          onChange={(event) =>
                                            setSelectedLabels((current) =>
                                              event.currentTarget.checked
                                                ? [...current, label.name]
                                                : current.filter(
                                                    (name) =>
                                                      name !== label.name,
                                                  ),
                                            )
                                          }
                                        />
                                        <span
                                          className="label-swatch"
                                          style={{
                                            backgroundColor: label.color,
                                          }}
                                        />
                                        <span>{t(label.name)}</span>
                                      </label>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="replication-label-empty">
                                    {t("当前实例没有可用于复制筛选的全局标签")}
                                  </div>
                                )}
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="policy-form-group">
              <header className="policy-group-heading">
                <h4>{t("目标路径")}</h4>
                <p>{t("控制复制后的命名空间与仓库路径层级")}</p>
              </header>
              <div className="form-grid two-columns">
                <label className="field">
                  <span>{t("目标命名空间")}</span>
                  <input
                    name="dest_namespace"
                    maxLength={255}
                    pattern="[a-z0-9]+(?:[/._-][a-z0-9]+)*"
                    value={namespace}
                    placeholder={t("留空保持原路径")}
                    autoComplete="off"
                    onChange={(event) =>
                      setNamespace(event.currentTarget.value)
                    }
                  />
                  <small>{t("仅支持小写字母、数字及 / . _ - 分隔。")}</small>
                </label>
                <label className="field">
                  <span>{t("替换路径层级")}</span>
                  <UnifiedSelect
                    name="dest_namespace_replace_count"
                    ariaLabel={t("替换路径层级")}
                    value={replaceCount}
                    disabled={!namespace.trim()}
                    options={[
                      { value: "-1", label: t("替换全部路径") },
                      { value: "0", label: t("不替换，仅添加前缀") },
                      { value: "1", label: t("替换 1 层") },
                      { value: "2", label: t("替换 2 层") },
                      { value: "3", label: t("替换 3 层") },
                    ]}
                    onChange={setReplaceCount}
                  />
                  <small>{t("未填写目标命名空间时不生效。")}</small>
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="policy-form-section">
          <header className="policy-section-heading">
            <h3>{t("执行设置")}</h3>
            <p>{t("配置策略何时运行，以及复制任务如何传输")}</p>
          </header>
          <div className="policy-section-content">
            <div className="policy-form-group">
              <header className="policy-group-heading">
                <h4>{t("触发计划")}</h4>
                <p>{t("可用方式由复制来源的 Registry Adapter 决定")}</p>
              </header>
              <div className="policy-choice-field">
                <span className="policy-field-label">{t("触发方式")}</span>
                <div
                  className="policy-choice-grid policy-trigger-choices"
                  role="radiogroup"
                  aria-label={t("触发方式")}
                >
                  {uniqueTriggerOptions.map((value) => (
                    <label key={value}>
                      <input
                        name="trigger"
                        type="radio"
                        value={value}
                        checked={trigger === value}
                        onChange={() => setTrigger(value)}
                      />
                      <span>
                        <strong>{triggerLabel(value, t)}</strong>
                        <small>
                          {t(
                            {
                              manual: "按需启动复制任务",
                              scheduled: "使用 Cron 周期运行",
                              event_based: "资源变更时自动运行",
                            }[value],
                          )}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-grid two-columns policy-trigger-settings">
                <label
                  className="field policy-cron-field"
                  data-policy-field="cron"
                  hidden={trigger !== "scheduled"}
                >
                  <span>{t("Cron 表达式")}</span>
                  <input
                    name="cron"
                    required={trigger === "scheduled"}
                    maxLength={255}
                    defaultValue={
                      policy?.trigger?.trigger_settings?.cron ?? "0 0 2 * * *"
                    }
                    placeholder="0 0 2 * * *"
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="check-grid policy-trigger-options">
                <label
                  className="check-row"
                  data-policy-field="deletion"
                  hidden={!(direction === "push" && trigger === "event_based")}
                >
                  <input
                    name="replicate_deletion"
                    type="checkbox"
                    checked={replicateDeletion}
                    onChange={(event) =>
                      setReplicateDeletion(event.currentTarget.checked)
                    }
                  />
                  <span>
                    <strong>{t("同步删除操作")}</strong>
                    <small>{t("仅推送方向的事件触发支持")}</small>
                  </span>
                </label>
                <label
                  className="check-row"
                  data-policy-field="single-active"
                  hidden={trigger === "event_based"}
                >
                  <input
                    name="single_active_replication"
                    type="checkbox"
                    checked={singleActive}
                    onChange={(event) =>
                      setSingleActive(event.currentTarget.checked)
                    }
                  />
                  <span>
                    <strong>{t("单活执行")}</strong>
                    <small>{t("上次执行结束前跳过重复运行")}</small>
                  </span>
                </label>
              </div>
            </div>
            <div className="policy-form-group">
              <header className="policy-group-heading">
                <h4>{t("传输行为")}</h4>
                <p>{t("限制单任务带宽并控制目标覆盖方式")}</p>
              </header>
              <div className="form-grid two-columns">
                <label className="field">
                  <span>{t("单任务带宽")}</span>
                  <div className="policy-speed-input">
                    <input
                      name="speed"
                      type="number"
                      required
                      min={-1}
                      max={2147483647}
                      step={1}
                      defaultValue={
                        speedInMbps ? initialSpeed / 1024 : initialSpeed
                      }
                    />
                    <UnifiedSelect
                      name="speed_unit"
                      ariaLabel={t("单任务带宽")}
                      value={speedUnit}
                      options={[
                        { value: "Kbps", label: "Kbps" },
                        { value: "Mbps", label: "Mbps" },
                      ]}
                      onChange={setSpeedUnit}
                    />
                  </div>
                  <small>
                    {t("-1 表示不限速；限制值作用于每个复制任务。")}
                  </small>
                </label>
                <div className="policy-transfer-flags">
                  <label className="check-row">
                    <input
                      name="override"
                      type="checkbox"
                      checked={override}
                      onChange={(event) =>
                        setOverride(event.currentTarget.checked)
                      }
                    />
                    <span>
                      <strong>{t("覆盖已有制品")}</strong>
                      <small>{t("目标存在同名资源时覆盖")}</small>
                    </span>
                  </label>
                  <label className="check-row">
                    <input
                      name="copy_by_chunk"
                      type="checkbox"
                      checked={copyByChunk}
                      disabled={!remoteInfo.supported_copy_by_chunk}
                      onChange={(event) =>
                        setCopyByChunk(event.currentTarget.checked)
                      }
                    />
                    <span>
                      <strong>{t("分块复制")}</strong>
                      <small>
                        {t(
                          remoteInfo.supported_copy_by_chunk
                            ? "当前远端适配器支持分块复制"
                            : "当前远端适配器不支持分块复制",
                        )}
                      </small>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ControlDialog>
  );
}

export function RunReplicationPolicyDialog({
  policy,
  onClose,
  onStarted,
}: {
  policy: ReplicationPolicy;
  onClose: () => void;
  onStarted: () => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="立即执行复制策略"
      subtitle={policy.name}
      submitLabel="启动复制"
      submitIcon="play"
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate("replication-executions", {}, "POST", {
          policy_id: policy.id,
        });
        onStarted();
      }}
    >
      <div className="destructive-message">
        <Icon name="info" />
        <span>
          {t("Harbor 将立即创建一次复制执行，可在执行记录中查看进度。")}
        </span>
      </div>
    </ControlDialog>
  );
}

export function DeleteReplicationPolicyDialog({
  policy,
  onClose,
  onDeleted,
}: {
  policy: ReplicationPolicy;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale } = useLocale();
  return (
    <ControlDialog
      title="删除复制策略"
      subtitle={policy.name}
      submitLabel="删除策略"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "replication-policy",
          { id: policy.id },
          "DELETE",
        );
        onDeleted();
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>
          {locale === "en-US"
            ? `Policy ${policy.name ?? "-"} will be permanently deleted.`
            : `策略 ${policy.name ?? "-"} 将被永久删除。`}
        </span>
      </div>
    </ControlDialog>
  );
}

export function StopReplicationExecutionDialog({
  execution,
  onClose,
  onStopped,
}: {
  execution: ReplicationExecution;
  onClose: () => void;
  onStopped: () => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="停止复制执行"
      subtitle={`执行 #${String(execution.id ?? "-")}`}
      submitLabel="停止执行"
      submitIcon="x"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "replication-execution",
          { id: execution.id },
          "PUT",
        );
        onStopped();
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>
          {t("已完成的任务不会回滚，正在传输的任务将由 Harbor 请求停止。")}
        </span>
      </div>
    </ControlDialog>
  );
}

export function ReplicationExecutionDialog({
  execution: initialExecution,
  onClose,
  onChanged,
  onNotice,
}: {
  execution: ReplicationExecution;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [execution, setExecution] = useState(initialExecution);
  const [tasks, setTasks] = useState<ReplicationTask[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stopConfirm, setStopConfirm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ReplicationTask>();
  const [taskLog, setTaskLog] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [timezone, setTimezone] = useState<LogTimezone>("local");
  const logController = useRef<AbortController | undefined>(undefined);
  const logVersion = useRef(0);
  const logView = useRef<HTMLElement>(null);
  const executionId = initialExecution.id;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void Promise.all([
      controlApi.data<ReplicationExecution>(
        "replication-execution",
        { id: executionId },
        controller.signal,
      ),
      controlApi.list<ReplicationTask>(
        "replication-tasks",
        { id: executionId, page: 1, page_size: 100, sort: "-start_time" },
        controller.signal,
      ),
    ])
      .then(([detail, collection]) => {
        if (controller.signal.aborted) return;
        if (detail) setExecution(detail);
        setTasks(collection.items);
        setTaskTotal(collection.pagination.total);
      })
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [executionId]);

  useEffect(
    () => () => {
      logVersion.current += 1;
      logController.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!selectedTask || logLoading) return;
    logView.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    logView.current?.focus({ preventScroll: true });
  }, [logLoading, selectedTask]);

  async function loadTaskLog(task: ReplicationTask) {
    logController.current?.abort();
    const controller = new AbortController();
    logController.current = controller;
    const version = logVersion.current + 1;
    logVersion.current = version;
    setSelectedTask(task);
    setTaskLog("");
    setLogLoading(true);
    try {
      const value = await controlApi.data<unknown>(
        "replication-task-log",
        { id: execution.id, task: task.id },
        controller.signal,
      );
      if (logVersion.current === version) setTaskLog(logText(value));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError")
        return;
      if (logVersion.current === version)
        setTaskLog(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
    } finally {
      if (logVersion.current === version) setLogLoading(false);
    }
  }

  if (stopConfirm) {
    return (
      <StopReplicationExecutionDialog
        execution={execution}
        onClose={() => setStopConfirm(false)}
        onStopped={() => onChanged("已向 Harbor 提交停止请求")}
      />
    );
  }

  const canStop = execution.status?.toLowerCase() === "inprogress";
  const subtitle = loading
    ? t("正在读取执行详情和任务列表")
    : locale === "en-US"
      ? `${t(executionStatusLabel(execution.status))} · ${formatNumber(taskTotal, locale)} tasks`
      : `${t(executionStatusLabel(execution.status))} · ${formatNumber(taskTotal, locale)} 个任务`;

  return (
    <ControlDialog
      title={
        locale === "en-US"
          ? `Replication execution #${String(execution.id ?? "-")}`
          : `复制执行 #${String(execution.id ?? "-")}`
      }
      subtitle={subtitle}
      submitLabel="关闭"
      submitIcon="x"
      showCancel={false}
      dialogClass="control-dialog-wide"
      initialFocusSelector={null}
      onClose={onClose}
      onSubmit={() => {
        onClose();
        return Promise.resolve();
      }}
    >
      {loading ? (
        <div className="dialog-loading" role="status">
          <span className="spinner" />
          <span>{t("正在载入复制任务...")}</span>
        </div>
      ) : error ? (
        <div className="empty-table permission-table">
          <strong>{t("复制任务载入失败")}</strong>
          <span>{error}</span>
        </div>
      ) : (
        <>
          <section className="execution-summary">
            <div className="execution-summary-head">
              <div>
                <StatusBadge status={execution.status} />
                <span>{triggerLabel(execution.trigger, t)}</span>
                <span>{formatDate(execution.start_time, locale)}</span>
              </div>
              {canStop ? (
                <button
                  className="button button-small button-danger"
                  type="button"
                  onClick={() => setStopConfirm(true)}
                >
                  <Icon name="x" />
                  <span>{t("停止执行")}</span>
                </button>
              ) : null}
            </div>
            <dl className="execution-stats">
              {[
                ["总任务", execution.total ?? taskTotal, ""],
                ["成功", execution.succeed, "success-text"],
                ["失败", execution.failed, "danger-text"],
                ["进行中", execution.in_progress, ""],
                ["已停止", execution.stopped, ""],
              ].map(([label, value, className]) => (
                <div key={String(label)}>
                  <dt>{t(String(label))}</dt>
                  <dd className={String(className)}>
                    {formatNumber(value as number | undefined, locale)}
                  </dd>
                </div>
              ))}
              <div>
                <dt>{t("耗时")}</dt>
                <dd>
                  {formatDuration(
                    execution.start_time,
                    execution.end_time,
                    locale,
                  )}
                </dd>
              </div>
            </dl>
          </section>
          <section className="replication-task-section">
            <div className="section-heading compact-heading">
              <div>
                <h3>{t("复制任务")}</h3>
                <p>
                  {locale === "en-US"
                    ? `Items 1-${formatNumber(tasks.length, locale)} of ${formatNumber(taskTotal, locale)}`
                    : `第 1-${formatNumber(tasks.length, locale)} 项，共 ${formatNumber(taskTotal, locale)} 项`}
                </p>
              </div>
            </div>
            <div className="table-scroll replication-task-table">
              {!tasks.length ? (
                <div className="empty-table">
                  <strong>{t("暂无复制任务")}</strong>
                  <span>{t("该执行记录还没有返回任务明细。")}</span>
                </div>
              ) : (
                <table className="replication-task-table-grid">
                  <thead>
                    <tr>
                      <th className="id-column">{t("任务")}</th>
                      <th>{t("资源类型")}</th>
                      <th className="replication-task-source">{t("源")}</th>
                      <th className="replication-task-target">{t("目标")}</th>
                      <th className="replication-task-operation">
                        {t("操作")}
                      </th>
                      <th className="replication-task-status">{t("状态")}</th>
                      <th className="replication-task-start-time table-cell-time">
                        {t("开始时间")}
                      </th>
                      <th className="replication-task-end-time table-cell-time">
                        {t("结束时间")}
                      </th>
                      <th className="replication-task-log">{t("日志")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td className="id-cell">#{task.id}</td>
                        <td>
                          {locale === "en-US" &&
                          resourceTypeLabel(task.resource_type) === "镜像"
                            ? "Images"
                            : t(resourceTypeLabel(task.resource_type))}
                        </td>
                        <td className="replication-task-source">
                          <span
                            className="replication-resource mono"
                            title={task.src_resource}
                          >
                            {task.src_resource ?? "-"}
                          </span>
                        </td>
                        <td className="replication-task-target">
                          <span
                            className="replication-resource mono"
                            title={task.dst_resource}
                          >
                            {task.dst_resource ?? "-"}
                          </span>
                        </td>
                        <td className="replication-task-operation">
                          {t(operationLabel(task.operation))}
                        </td>
                        <td className="replication-task-status">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="replication-task-start-time table-cell-time">
                          {formatDate(task.start_time, locale)}
                        </td>
                        <td className="replication-task-end-time table-cell-time">
                          {replicationTaskDate(task.end_time, locale)}
                        </td>
                        <td className="replication-task-log">
                          {task.status?.toLowerCase() === "initialized" ? (
                            "-"
                          ) : (
                            <button
                              className="icon-button"
                              type="button"
                              title={t("查看日志")}
                              aria-label={
                                locale === "en-US"
                                  ? `View task ${String(task.id)} log`
                                  : `查看任务 ${String(task.id)} 日志`
                              }
                              onClick={() => void loadTaskLog(task)}
                            >
                              <Icon name="history" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
          {selectedTask ? (
            <section
              ref={logView}
              className="replication-log-view"
              tabIndex={-1}
            >
              <header>
                <div>
                  <h3>{t("任务日志")}</h3>
                  <p>
                    {locale === "en-US"
                      ? `Execution #${String(execution.id)} · Task #${String(selectedTask.id)}`
                      : `执行 #${String(execution.id)} · 任务 #${String(selectedTask.id)}`}
                  </p>
                </div>
                <div className="log-view-actions">
                  <span>
                    {logLoading
                      ? t("正在读取")
                      : locale === "en-US"
                        ? `${formatNumber(taskLog.length, locale)} characters`
                        : `${formatNumber(taskLog.length, locale)} 字符`}
                  </span>
                  <LogTimezoneControl value={timezone} onChange={setTimezone} />
                  <button
                    className="icon-button"
                    type="button"
                    title={t("刷新日志")}
                    aria-label={t("刷新复制任务日志")}
                    onClick={() => void loadTaskLog(selectedTask)}
                  >
                    <Icon name="refresh" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("复制日志")}
                    aria-label={t("复制当前任务日志")}
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(taskLog)
                        .then(() => onNotice("已复制到剪贴板"))
                        .catch(() => onNotice("无法写入剪贴板", true))
                    }
                  >
                    <Icon name="copy" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("下载日志")}
                    aria-label={t("下载复制任务日志")}
                    onClick={() => {
                      if (!taskLog) {
                        onNotice("当前没有可下载的复制任务日志", true);
                        return;
                      }
                      downloadText(
                        taskLog,
                        `harbor-replication-${String(execution.id)}-${String(selectedTask.id)}.log`,
                      );
                      onNotice("复制任务日志已下载");
                    }}
                  >
                    <Icon name="download" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("关闭日志")}
                    aria-label={t("关闭复制任务日志")}
                    onClick={() => {
                      logVersion.current += 1;
                      logController.current?.abort();
                      setSelectedTask(undefined);
                      setTaskLog("");
                    }}
                  >
                    <Icon name="x" />
                  </button>
                </div>
              </header>
              <StructuredLog
                value={taskLog}
                timezone={timezone}
                emptyMessage="Harbor 没有返回复制任务日志。"
                ariaLabel="复制任务日志"
              />
            </section>
          ) : null}
        </>
      )}
    </ControlDialog>
  );
}
