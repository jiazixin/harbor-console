import { type SubmitEvent, useState } from "react";
import { controlApi } from "../../app/api-client";
import { errorText, UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type {
  CveAllowlist,
  ProjectMetadata,
  ProjectQuota,
  ProjectScanner,
  ProjectSummary,
  Registry,
} from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import {
  CveAllowlistEditor,
  useCveAllowlistDraft,
} from "../../components/cve-allowlist-editor";
import { formErrors, FormErrorsContext } from "../../components/form-errors";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import {
  default as sharedPrimitiveStyles,
  default as uiStyles0,
} from "../../components/shared-ui.module.css";
import { ToggleSetting } from "../../components/toggle-setting";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { artifactKeys } from "../artifacts/public";
import { repositoryKeys } from "../repositories/public";
import { projectKeys } from "./project-keys";
import uiStyles1 from "./project-settings-section.module.css";
import styles from "./projects.module.css";

// Queries that a write in this module can change.
const affectedQueries = [projectKeys.all, repositoryKeys.all, artifactKeys.all];

export type ProjectSettingsData = {
  scanner?: ProjectScanner;
  candidates: ProjectScanner[];
  proxyRegistry?: Registry;
  quota?: ProjectQuota;
  scannerError?: string;
  candidatesError?: string;
  proxyRegistryError?: string;
  quotaError?: string;
};

function metadataBoolean(value: string | undefined): boolean {
  return value === "true";
}

function quotaGiB(quota: ProjectQuota | undefined): number {
  const value = quota?.hard?.storage;
  if (value === undefined || value < 0) return -1;
  return Math.round(value / 1024 ** 3);
}

function integerLimit(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || (parsed !== -1 && parsed <= 0)) {
    throw new UserInputError(`${label}必须是 -1 或正整数`);
  }
  return parsed;
}

function quotaBytes(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < -1 || parsed > 1_048_576) {
    throw new UserInputError("存储配额必须是 -1 或 0 至 1048576 的整数");
  }
  return parsed === -1 ? -1 : parsed * 1024 ** 3;
}

function scannerLabel(
  scanner: ProjectScanner,
  translate: (source: string) => string,
): string {
  const label = scanner.name ?? scanner.adapter ?? scanner.uuid;
  return scanner.is_default ? `${label}${translate("（系统默认）")}` : label;
}

/** Project metadata switches edited with a toggle, in display order. */
const policyToggles = [
  {
    name: "public",
    title: "项目公开",
    description: "允许未登录用户拉取制品",
  },
  {
    name: "auto_scan",
    title: "推送后自动扫描",
    description: "新制品入库后自动触发漏洞扫描",
  },
  {
    name: "auto_sbom_generation",
    title: "自动生成 SBOM",
    description: "新制品入库后生成软件物料清单",
  },
  {
    name: "enable_content_trust",
    title: "Notary 内容信任",
    description: "要求 Notary 签名验证",
  },
  {
    name: "enable_content_trust_cosign",
    title: "Cosign 内容信任",
    description: "要求 Cosign 签名验证",
  },
  {
    name: "prevent_vul",
    title: "阻止高风险制品拉取",
    description: "按下方风险级别阻止拉取",
  },
  {
    name: "reuse_sys_cve_allowlist",
    title: "继承系统 CVE 白名单",
    description: "关闭后使用此项目的独立白名单",
  },
] as const;

type PolicyName =
  (typeof policyToggles)[number]["name"] | "proxy_cache_local_on_not_found";
type ProjectPolicies = Record<PolicyName, boolean>;

function projectPolicies(metadata: ProjectMetadata): ProjectPolicies {
  return {
    public: metadataBoolean(metadata.public),
    auto_scan: metadataBoolean(metadata.auto_scan),
    auto_sbom_generation: metadataBoolean(metadata.auto_sbom_generation),
    enable_content_trust: metadataBoolean(metadata.enable_content_trust),
    enable_content_trust_cosign: metadataBoolean(
      metadata.enable_content_trust_cosign,
    ),
    prevent_vul: metadataBoolean(metadata.prevent_vul),
    // Harbor treats a missing value as inheriting the system allowlist.
    reuse_sys_cve_allowlist: metadata.reuse_sys_cve_allowlist !== "false",
    proxy_cache_local_on_not_found: metadataBoolean(
      metadata.proxy_cache_local_on_not_found,
    ),
  };
}

type ProjectModeSummaryProps = {
  project: ProjectSummary;
  settings: ProjectSettingsData;
};

function ProjectModeSummary({ project, settings }: ProjectModeSummaryProps) {
  const { t } = useLocale();
  const proxyCache = (project.registry_id ?? 0) > 0;
  const proxyName =
    settings.proxyRegistry?.name ??
    `${t("代理远端仓库")} #${String(project.registry_id)}`;
  return (
    <>
      <section className={resolveClasses("project-mode-summary")}>
        <div>
          <span className={resolveClasses("cell-icon")}>
            <Icon name={proxyCache ? "refresh" : "folder"} />
          </span>
          <div>
            <strong>{t(proxyCache ? "镜像代理项目" : "普通项目")}</strong>
            <small>
              {proxyCache
                ? `${proxyName} · ${settings.proxyRegistry?.url ?? t("地址未返回")}`
                : t("项目创建后不能切换为镜像代理模式")}
            </small>
          </div>
        </div>
        <span
          className={resolveClasses(
            `badge ${proxyCache ? "badge-orange" : ""}`,
          )}
        >
          {proxyCache ? "Proxy Cache" : "Standard"}
        </span>
      </section>
      {settings.proxyRegistryError ? (
        <div
          className={resolveClasses("notice notice-warning settings-warning")}
        >
          <Icon name="alert" />
          <span>
            {t("镜像代理仓库信息载入失败")}：{settings.proxyRegistryError}
          </span>
        </div>
      ) : null}
    </>
  );
}

type ProjectSettingsSectionProps = {
  project: ProjectSummary;
  settings: ProjectSettingsData;
  onSaved: () => void;
  onNotice: (message: string, error?: boolean) => void;
  onDelete: () => void;
};

export function ProjectSettingsSection({
  project,
  settings,
  onSaved,
  onNotice,
  onDelete,
}: ProjectSettingsSectionProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const metadata = project.metadata ?? {};
  const allowlist: CveAllowlist = project.cve_allowlist ?? {};
  const proxyCache = (project.registry_id ?? 0) > 0;
  const [policies, setPolicies] = useState(() => projectPolicies(metadata));
  const setPolicy = (name: PolicyName, enabled: boolean) => {
    setPolicies((current) => ({ ...current, [name]: enabled }));
  };
  const [severity, setSeverity] = useState(metadata.severity ?? "critical");
  const [storageLimit, setStorageLimit] = useState(
    String(quotaGiB(settings.quota)),
  );
  const [proxySpeed, setProxySpeed] = useState(metadata.proxy_speed_kb ?? "-1");
  const [maxUpstreamConnections, setMaxUpstreamConnections] = useState(
    metadata.max_upstream_conn ?? "-1",
  );
  const [scannerId, setScannerId] = useState(settings.scanner?.uuid ?? "");
  const allowlistDraft = useCveAllowlistDraft(allowlist);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const scannerOptions = (() => {
    const scanners = new Map<string, ProjectScanner>();
    if (settings.scanner) scanners.set(settings.scanner.uuid, settings.scanner);
    settings.candidates.forEach((scanner) =>
      scanners.set(scanner.uuid, scanner),
    );
    return [...scanners.values()].map((scanner) => ({
      value: scanner.uuid,
      label: scannerLabel(scanner, t),
    }));
  })();
  const scannerError = settings.scannerError ?? settings.candidatesError;
  const quotaAvailable = Boolean(settings.quota?.id);

  async function saveSettings(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    if (saving) return;
    setSaving(true);
    try {
      const requestedQuota = quotaAvailable ? quotaBytes(storageLimit) : null;
      const nextMetadata = {
        ...metadata,
        public: String(policies.public),
        auto_scan: String(policies.auto_scan),
        auto_sbom_generation: String(policies.auto_sbom_generation),
        prevent_vul: String(policies.prevent_vul),
        severity,
        reuse_sys_cve_allowlist: String(policies.reuse_sys_cve_allowlist),
        enable_content_trust: String(policies.enable_content_trust),
        enable_content_trust_cosign: String(
          policies.enable_content_trust_cosign,
        ),
        ...(proxyCache
          ? {
              proxy_cache_local_on_not_found: String(
                policies.proxy_cache_local_on_not_found,
              ),
              proxy_speed_kb: String(integerLimit(proxySpeed, "上游带宽限制")),
              max_upstream_conn: String(
                integerLimit(maxUpstreamConnections, "上游最大连接数"),
              ),
            }
          : {}),
      };
      const payload: Record<string, unknown> = { metadata: nextMetadata };
      if (!policies.reuse_sys_cve_allowlist) {
        payload.cve_allowlist = allowlistDraft.toPayload();
      }
      await mutate({
        operation: "project",
        parameters: { project: project.name },
        method: "PUT",
        payload: payload,
      });
      const quota = settings.quota;
      if (
        quota &&
        requestedQuota !== null &&
        requestedQuota !== quota.hard?.storage
      ) {
        await mutate({
          operation: "quota",
          parameters: { id: quota.id },
          method: "PUT",
          payload: {
            hard: { storage: requestedQuota },
          },
        });
        const verified = await controlApi.data<ProjectQuota>("quota", {
          id: quota.id,
        });
        if (verified?.hard?.storage !== requestedQuota) {
          throw new UserInputError("Harbor 未持久化项目配额");
        }
      }
      if (
        scannerId &&
        scannerId !== settings.scanner?.uuid &&
        scannerOptions.some((option) => option.value === scannerId)
      ) {
        await mutate({
          operation: "project-scanner",
          parameters: { project: project.name },
          method: "PUT",
          payload: {
            uuid: scannerId,
          },
        });
      }
      onNotice("项目设置已保存");
      onSaved();
    } catch (saveError) {
      setFieldErrors(formErrors(saveError));
      onNotice(errorText(saveError), true);
    } finally {
      setSaving(false);
    }
  }

  const reuseSystemAllowlist = policies.reuse_sys_cve_allowlist;

  return (
    <section className={resolveClasses(styles.settingsLayout)}>
      <FormErrorsContext value={fieldErrors}>
        <form
          className={resolveClasses("settings-form")}
          onSubmit={(event) => void saveSettings(event)}
        >
          <div className={resolveClasses("section-heading")}>
            <div>
              <h2>{t("访问与安全")}</h2>
              <p>{t("项目级策略")}</p>
            </div>
            <button
              className={resolveClasses("button button-small button-primary")}
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <span className={resolveClasses("spinner button-spinner")} />
              ) : (
                <Icon name="check" />
              )}
              <span>{t(saving ? "正在保存" : "保存设置")}</span>
            </button>
          </div>
          <ProjectModeSummary project={project} settings={settings} />
          <div className={resolveClasses("settings-grid")}>
            {policyToggles.map((toggle) => (
              <ToggleSetting
                key={toggle.name}
                name={toggle.name}
                title={t(toggle.title)}
                description={t(toggle.description)}
                checked={policies[toggle.name]}
                onChange={(enabled) => {
                  setPolicy(toggle.name, enabled);
                }}
              />
            ))}
            {proxyCache ? (
              <ToggleSetting
                name="proxy_cache_local_on_not_found"
                title={t("上游未找到时使用本地制品")}
                description={t(
                  "远端返回未找到时，允许继续从本项目的本地缓存读取。",
                )}
                checked={policies.proxy_cache_local_on_not_found}
                onChange={(enabled) => {
                  setPolicy("proxy_cache_local_on_not_found", enabled);
                }}
              />
            ) : null}
          </div>
          <div className={resolveClasses("form-grid two-columns")}>
            <label className={resolveClasses("field")}>
              <span>{t("漏洞阻止级别")}</span>
              <UnifiedSelect
                ariaLabel={t("漏洞阻止级别")}
                value={severity}
                options={[
                  { value: "none", label: t("无") },
                  { value: "low", label: t("低危") },
                  { value: "medium", label: t("中危") },
                  { value: "high", label: t("高危") },
                  { value: "critical", label: t("严重") },
                ]}
                onChange={setSeverity}
              />
            </label>
            <label className={resolveClasses("field")}>
              <span>{t("存储配额（GiB）")}</span>
              <FormInput
                type="number"
                min={-1}
                max={1_048_576}
                step={1}
                value={storageLimit}
                disabled={!quotaAvailable}
                onChange={(event) => {
                  setStorageLimit(event.currentTarget.value);
                }}
              />
              <small className={resolveClasses("field-help")}>
                {(() => {
                  if (settings.quotaError) {
                    return `${t("配额读取失败")}：${settings.quotaError}`;
                  }
                  if (quotaAvailable) {
                    return t(
                      "输入 -1 表示不限制；保存后会从 Harbor 配额接口重新核验。",
                    );
                  }
                  return t("当前账号没有可管理的项目配额。");
                })()}
              </small>
            </label>
            {proxyCache ? (
              <>
                <label className={resolveClasses("field")}>
                  <span>{t("上游带宽限制（Kbps）")}</span>
                  <FormInput
                    type="number"
                    min={-1}
                    step={1}
                    value={proxySpeed}
                    onChange={(event) => {
                      setProxySpeed(event.currentTarget.value);
                    }}
                  />
                  <small className={resolveClasses("field-help")}>
                    {t("输入 -1 表示不限制。")}
                  </small>
                </label>
                <label className={resolveClasses("field")}>
                  <span>{t("上游最大连接数")}</span>
                  <FormInput
                    type="number"
                    min={-1}
                    step={1}
                    value={maxUpstreamConnections}
                    onChange={(event) => {
                      setMaxUpstreamConnections(event.currentTarget.value);
                    }}
                  />
                  <small className={resolveClasses("field-help")}>
                    {t("输入 -1 表示不限制。")}
                  </small>
                </label>
              </>
            ) : null}
            <label className={resolveClasses("field field-span")}>
              <span>{t("项目漏洞扫描器")}</span>
              <UnifiedSelect
                ariaLabel={t("项目漏洞扫描器")}
                value={scannerId}
                disabled={!scannerOptions.length}
                options={
                  scannerOptions.length
                    ? scannerOptions
                    : [{ value: "", label: t("暂无可用扫描器") }]
                }
                onChange={setScannerId}
              />
              <small className={resolveClasses("field-help")}>
                {t(
                  "项目扫描任务将使用此扫描器；未单独配置时 Harbor 返回系统默认扫描器。",
                )}
              </small>
            </label>
          </div>
          <section className={resolveClasses("project-allowlist-settings")}>
            <div className={resolveClasses("section-heading compact-heading")}>
              <div>
                <h3>{t("项目 CVE 白名单")}</h3>
                <p>
                  {t(
                    reuseSystemAllowlist
                      ? "当前继承系统白名单，独立配置不会参与风险判断"
                      : "只对当前项目生效",
                  )}
                </p>
              </div>
              <a
                className={resolveClasses("button button-small")}
                href="#/security/allowlist"
              >
                <Icon name="arrow-right" />
                <span>{t("查看系统白名单")}</span>
              </a>
            </div>
            <fieldset disabled={reuseSystemAllowlist}>
              <CveAllowlistEditor
                {...allowlistDraft.editorProps}
                disabled={reuseSystemAllowlist}
              />
            </fieldset>
          </section>
          {scannerError ? (
            <div
              className={resolveClasses(
                "notice notice-warning settings-warning",
              )}
            >
              <Icon name="alert" />
              <span>
                {t("扫描器配置载入失败")}：{scannerError}
              </span>
            </div>
          ) : null}
        </form>
      </FormErrorsContext>
      <section className={resolveClasses(styles.dangerZone)}>
        <div>
          <h2>{t("删除项目")}</h2>
          <p>{project.name}</p>
        </div>
        <button
          className={resolveClasses("button button-small button-danger")}
          type="button"
          onClick={onDelete}
        >
          <Icon name="trash" />
          <span>{t("删除项目")}</span>
        </button>
      </section>
    </section>
  );
}

const resolveClasses = createClassNames({
  critical: sharedPrimitiveStyles.critical,
  high: sharedPrimitiveStyles.high,
  medium: sharedPrimitiveStyles.medium,
  icon: uiStyles0.icon,
  "toggle-setting": uiStyles0.toggleSetting,
  "unified-select": uiStyles0.unifiedSelect,
  "cell-icon": uiStyles0.cellIcon,
  badge: uiStyles0.badge,
  "badge-orange": uiStyles0.badgeOrange,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  "settings-warning": uiStyles0.settingsWarning,
  "settings-form": uiStyles0.settingsForm,
  "section-heading": uiStyles0.sectionHeading,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  spinner: uiStyles0.spinner,
  "button-spinner": uiStyles0.buttonSpinner,
  "settings-grid": uiStyles0.settingsGrid,
  "form-grid": uiStyles0.formGrid,
  "two-columns": uiStyles0.twoColumns,
  field: uiStyles0.field,
  "field-help": uiStyles0.fieldHelp,
  "field-span": uiStyles0.fieldSpan,
  "compact-heading": uiStyles0.compactHeading,
  "button-danger": uiStyles0.buttonDanger,
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
  "project-mode-summary": uiStyles1.projectModeSummary,
  "project-allowlist-settings": uiStyles1.projectAllowlistSettings,
});
