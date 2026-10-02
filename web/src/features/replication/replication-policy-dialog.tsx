import { controlApi } from "../../app/api-client";
import type {
  ProjectLabel,
  Registry,
  ReplicationAdapterInfo,
  ReplicationPolicy,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import { triggerLabel } from "../../components/status-badge";
import { UnifiedSelect } from "../../components/unified-select";

import { useReplicationPolicyForm } from "./use-replication-policy-form";
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
  const form = useReplicationPolicyForm({
    policy,
    registries,
    labels,
    localInfo,
  });
  const { capabilityError, capabilityReady, createPayload } = form;

  return (
    <ControlDialog
      title={policy ? "编辑复制策略" : "新建复制策略"}
      subtitle={policy?.name ?? "Harbor v2.15 官方复制策略"}
      submitLabel={policy ? "保存策略" : "创建策略"}
      submitDisabled={!capabilityReady}
      dialogClass="control-dialog-wide"
      onClose={onClose}
      onSubmit={async (formData) => {
        const payload = createPayload(formData);
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
        <PolicyIdentitySection form={form} policy={policy} />

        <PolicyRulesSection form={form} registries={registries} />

        <PolicyExecutionSection form={form} policy={policy} />
      </div>
    </ControlDialog>
  );
}

function PolicyIdentitySection({
  form,
  policy,
}: {
  form: ReturnType<typeof useReplicationPolicyForm>;
  policy?: ReplicationPolicy;
}) {
  const { t, enabled, setEnabled } = form;
  return (
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
  );
}

function PolicyRulesSection({
  form,
  registries,
}: {
  form: ReturnType<typeof useReplicationPolicyForm>;
  registries: Registry[];
}) {
  const {
    locale,
    t,
    direction,
    setDirection,
    registryId,
    setRegistryId,
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
    capability,
    filterStyles,
    labelCandidates,
  } = form;
  return (
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
                  {t("当前适配器未声明资源筛选器，将复制其支持的全部资源。")}
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
                                  ...(resourceFilter ? [resourceFilter] : []),
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
                                                (name) => name !== label.name,
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
                onChange={(event) => setNamespace(event.currentTarget.value)}
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
  );
}

function PolicyExecutionSection({
  form,
  policy,
}: {
  form: ReturnType<typeof useReplicationPolicyForm>;
  policy?: ReplicationPolicy;
}) {
  const {
    t,
    initialSpeed,
    speedInMbps,
    speedUnit,
    setSpeedUnit,
    direction,
    trigger,
    setTrigger,
    replicateDeletion,
    setReplicateDeletion,
    singleActive,
    setSingleActive,
    override,
    setOverride,
    copyByChunk,
    setCopyByChunk,
    remoteInfo,
    uniqueTriggerOptions,
  } = form;
  return (
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
              <small>{t("-1 表示不限速；限制值作用于每个复制任务。")}</small>
            </label>
            <div className="policy-transfer-flags">
              <label className="check-row">
                <input
                  name="override"
                  type="checkbox"
                  checked={override}
                  onChange={(event) => setOverride(event.currentTarget.checked)}
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
  );
}
