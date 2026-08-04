import { type FormEvent, useMemo, useState } from "react";

import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type {
  CveAllowlist,
  ProjectQuota,
  ProjectScanner,
  ProjectSummary,
  Registry,
} from "../../app/models";
import { CveAllowlistEditor } from "../../components/cve-allowlist-editor";
import { Icon } from "../../components/icons";
import { ToggleSetting } from "../../components/toggle-setting";
import { UnifiedSelect } from "../../components/unified-select";

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

function expirationInputValue(value: number | null | undefined): string {
  if (!value) return "";
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function parseCveItems(value: string): { cve_id: string }[] {
  const unique = [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  const invalid = unique.find((item) => !/^CVE-\d{4}-\d{4,}$/.test(item));
  if (invalid) {
    throw new Error(`CVE 编号 ${invalid} 格式无效，应类似 CVE-2026-1842`);
  }
  if (unique.length > 1000) throw new Error("CVE 白名单最多包含 1000 项");
  return unique.map((cve_id) => ({ cve_id }));
}

function expirationTimestamp(permanent: boolean, expiresAt: string) {
  if (permanent) return null;
  if (!expiresAt) throw new Error("非永久白名单必须选择到期日期");
  const value = new Date(`${expiresAt}T23:59:59`).getTime();
  if (!Number.isFinite(value)) throw new Error("白名单到期日期无效");
  return Math.floor(value / 1000);
}

function quotaGiB(quota: ProjectQuota | undefined): number {
  const value = quota?.hard?.storage;
  if (value === undefined || value < 0) return -1;
  return Math.round(value / 1024 ** 3);
}

function integerLimit(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || (parsed !== -1 && parsed <= 0)) {
    throw new Error(`${label}必须是 -1 或正整数`);
  }
  return parsed;
}

function quotaBytes(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < -1 || parsed > 1_048_576) {
    throw new Error("存储配额必须是 -1 或 0 至 1048576 的整数");
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

export function ProjectSettingsSection({
  project,
  settings,
  onSaved,
  onNotice,
  onDelete,
}: {
  project: ProjectSummary;
  settings: ProjectSettingsData;
  onSaved: () => void;
  onNotice: (message: string, error?: boolean) => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const metadata = project.metadata ?? {};
  const allowlist: CveAllowlist = project.cve_allowlist ?? {};
  const proxyCache = (project.registry_id ?? 0) > 0;
  const initialPermanent = !allowlist.expires_at;
  const [publicProject, setPublicProject] = useState(
    metadataBoolean(metadata.public),
  );
  const [autoScan, setAutoScan] = useState(metadataBoolean(metadata.auto_scan));
  const [autoSbom, setAutoSbom] = useState(
    metadataBoolean(metadata.auto_sbom_generation),
  );
  const [notaryTrust, setNotaryTrust] = useState(
    metadataBoolean(metadata.enable_content_trust),
  );
  const [cosignTrust, setCosignTrust] = useState(
    metadataBoolean(metadata.enable_content_trust_cosign),
  );
  const [preventVulnerability, setPreventVulnerability] = useState(
    metadataBoolean(metadata.prevent_vul),
  );
  const [reuseSystemAllowlist, setReuseSystemAllowlist] = useState(
    metadata.reuse_sys_cve_allowlist !== "false",
  );
  const [proxyFallback, setProxyFallback] = useState(
    metadataBoolean(metadata.proxy_cache_local_on_not_found),
  );
  const [severity, setSeverity] = useState(metadata.severity ?? "critical");
  const [storageLimit, setStorageLimit] = useState(
    String(quotaGiB(settings.quota)),
  );
  const [proxySpeed, setProxySpeed] = useState(metadata.proxy_speed_kb ?? "-1");
  const [maxUpstreamConnections, setMaxUpstreamConnections] = useState(
    metadata.max_upstream_conn ?? "-1",
  );
  const [scannerId, setScannerId] = useState(settings.scanner?.uuid ?? "");
  const [permanent, setPermanent] = useState(initialPermanent);
  const [expiresAt, setExpiresAt] = useState(
    expirationInputValue(allowlist.expires_at),
  );
  const [cves, setCves] = useState(
    (allowlist.items ?? [])
      .map((item) => item.cve_id?.trim() ?? "")
      .filter(Boolean)
      .join("\n"),
  );
  const [saving, setSaving] = useState(false);
  const scannerOptions = useMemo(() => {
    const scanners = new Map<string, ProjectScanner>();
    if (settings.scanner) scanners.set(settings.scanner.uuid, settings.scanner);
    settings.candidates.forEach((scanner) =>
      scanners.set(scanner.uuid, scanner),
    );
    return [...scanners.values()].map((scanner) => ({
      value: scanner.uuid,
      label: scannerLabel(scanner, t),
    }));
  }, [settings.candidates, settings.scanner, t]);
  const scannerError = settings.scannerError ?? settings.candidatesError;
  const quotaAvailable = Boolean(settings.quota?.id);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const requestedQuota = quotaAvailable ? quotaBytes(storageLimit) : null;
      const nextMetadata = {
        ...metadata,
        public: String(publicProject),
        auto_scan: String(autoScan),
        auto_sbom_generation: String(autoSbom),
        prevent_vul: String(preventVulnerability),
        severity,
        reuse_sys_cve_allowlist: String(reuseSystemAllowlist),
        enable_content_trust: String(notaryTrust),
        enable_content_trust_cosign: String(cosignTrust),
        ...(proxyCache
          ? {
              proxy_cache_local_on_not_found: String(proxyFallback),
              proxy_speed_kb: String(integerLimit(proxySpeed, "上游带宽限制")),
              max_upstream_conn: String(
                integerLimit(maxUpstreamConnections, "上游最大连接数"),
              ),
            }
          : {}),
      };
      const payload: Record<string, unknown> = { metadata: nextMetadata };
      if (!reuseSystemAllowlist) {
        payload.cve_allowlist = {
          expires_at: expirationTimestamp(permanent, expiresAt),
          items: parseCveItems(cves),
        };
      }
      await controlApi.mutate(
        "project",
        { project: project.name },
        "PUT",
        payload,
      );
      const quota = settings.quota;
      if (
        quota &&
        requestedQuota !== null &&
        requestedQuota !== quota.hard?.storage
      ) {
        await controlApi.mutate("quota", { id: quota.id }, "PUT", {
          hard: { storage: requestedQuota },
        });
        const verified = await controlApi.data<ProjectQuota>("quota", {
          id: quota.id,
        });
        if (verified?.hard?.storage !== requestedQuota) {
          throw new Error("Harbor 未持久化项目配额");
        }
      }
      if (
        scannerId &&
        scannerId !== settings.scanner?.uuid &&
        scannerOptions.some((option) => option.value === scannerId)
      ) {
        await controlApi.mutate(
          "project-scanner",
          { project: project.name },
          "PUT",
          { uuid: scannerId },
        );
      }
      onNotice("项目设置已保存");
      onSaved();
    } catch (saveError) {
      onNotice(
        saveError instanceof Error ? saveError.message : String(saveError),
        true,
      );
    } finally {
      setSaving(false);
    }
  }

  const toggles = [
    {
      name: "public",
      title: "项目公开",
      description: "允许未登录用户拉取制品",
      checked: publicProject,
      setChecked: setPublicProject,
    },
    {
      name: "auto_scan",
      title: "推送后自动扫描",
      description: "新制品入库后自动触发漏洞扫描",
      checked: autoScan,
      setChecked: setAutoScan,
    },
    {
      name: "auto_sbom_generation",
      title: "自动生成 SBOM",
      description: "新制品入库后生成软件物料清单",
      checked: autoSbom,
      setChecked: setAutoSbom,
    },
    {
      name: "enable_content_trust",
      title: "Notary 内容信任",
      description: "要求 Notary 签名验证",
      checked: notaryTrust,
      setChecked: setNotaryTrust,
    },
    {
      name: "enable_content_trust_cosign",
      title: "Cosign 内容信任",
      description: "要求 Cosign 签名验证",
      checked: cosignTrust,
      setChecked: setCosignTrust,
    },
    {
      name: "prevent_vul",
      title: "阻止高风险制品拉取",
      description: "按下方风险级别阻止拉取",
      checked: preventVulnerability,
      setChecked: setPreventVulnerability,
    },
    {
      name: "reuse_sys_cve_allowlist",
      title: "继承系统 CVE 白名单",
      description: "关闭后使用此项目的独立白名单",
      checked: reuseSystemAllowlist,
      setChecked: setReuseSystemAllowlist,
    },
  ];

  return (
    <section className="settings-layout">
      <form
        className="settings-form"
        onSubmit={(event) => void saveSettings(event)}
      >
        <div className="section-heading">
          <div>
            <h2>{t("访问与安全")}</h2>
            <p>{t("项目级策略")}</p>
          </div>
          <button
            className="button button-small button-primary"
            type="submit"
            disabled={saving}
          >
            {saving ? (
              <span className="spinner button-spinner" />
            ) : (
              <Icon name="check" />
            )}
            <span>{t(saving ? "正在保存" : "保存设置")}</span>
          </button>
        </div>
        <section className="project-mode-summary">
          <div>
            <span className="cell-icon">
              <Icon name={proxyCache ? "refresh" : "folder"} />
            </span>
            <div>
              <strong>{t(proxyCache ? "镜像代理项目" : "普通项目")}</strong>
              <small>
                {proxyCache
                  ? `${settings.proxyRegistry?.name ?? `${t("远端仓库")} #${String(project.registry_id)}`} · ${settings.proxyRegistry?.url ?? t("地址未返回")}`
                  : t("项目创建后不能切换为镜像代理模式")}
              </small>
            </div>
          </div>
          <span className={`badge ${proxyCache ? "badge-orange" : ""}`}>
            {proxyCache ? "Proxy Cache" : "Standard"}
          </span>
        </section>
        {settings.proxyRegistryError ? (
          <div className="warning-banner settings-warning">
            <Icon name="alert" />
            <span>
              {t("镜像代理仓库信息载入失败")}：{settings.proxyRegistryError}
            </span>
          </div>
        ) : null}
        <div className="settings-grid">
          {toggles.map((toggle) => (
            <ToggleSetting
              key={toggle.name}
              name={toggle.name}
              title={t(toggle.title)}
              description={t(toggle.description)}
              checked={toggle.checked}
              onChange={toggle.setChecked}
            />
          ))}
          {proxyCache ? (
            <ToggleSetting
              name="proxy_cache_local_on_not_found"
              title={t("上游未找到时使用本地制品")}
              description={t(
                "远端返回未找到时，允许继续从本项目的本地缓存读取。",
              )}
              checked={proxyFallback}
              onChange={setProxyFallback}
            />
          ) : null}
        </div>
        <div className="form-grid two-columns">
          <label className="field">
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
          <label className="field">
            <span>{t("存储配额（GiB）")}</span>
            <input
              type="number"
              min={-1}
              max={1_048_576}
              step={1}
              value={storageLimit}
              disabled={!quotaAvailable}
              onChange={(event) => setStorageLimit(event.currentTarget.value)}
            />
            <small className="field-help">
              {settings.quotaError
                ? `${t("配额读取失败")}：${settings.quotaError}`
                : quotaAvailable
                  ? t(
                      "输入 -1 表示不限制；保存后会从 Harbor 配额接口重新核验。",
                    )
                  : t("当前账号没有可管理的项目配额。")}
            </small>
          </label>
          {proxyCache ? (
            <>
              <label className="field">
                <span>{t("上游带宽限制（Kbps）")}</span>
                <input
                  type="number"
                  min={-1}
                  step={1}
                  value={proxySpeed}
                  onChange={(event) => setProxySpeed(event.currentTarget.value)}
                />
                <small className="field-help">
                  {t("输入 -1 表示不限制。")}
                </small>
              </label>
              <label className="field">
                <span>{t("上游最大连接数")}</span>
                <input
                  type="number"
                  min={-1}
                  step={1}
                  value={maxUpstreamConnections}
                  onChange={(event) =>
                    setMaxUpstreamConnections(event.currentTarget.value)
                  }
                />
                <small className="field-help">
                  {t("输入 -1 表示不限制。")}
                </small>
              </label>
            </>
          ) : null}
          <label className="field field-span">
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
            <small className="field-help">
              {t(
                "项目扫描任务将使用此扫描器；未单独配置时 Harbor 返回系统默认扫描器。",
              )}
            </small>
          </label>
        </div>
        <section className="project-allowlist-settings">
          <div className="section-heading compact-heading">
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
            <a className="button button-small" href="#/security/allowlist">
              <Icon name="arrow-right" />
              <span>{t("查看系统白名单")}</span>
            </a>
          </div>
          <fieldset disabled={reuseSystemAllowlist}>
            <CveAllowlistEditor
              permanent={permanent}
              expiresAt={expiresAt}
              cves={cves}
              disabled={reuseSystemAllowlist}
              onPermanentChange={setPermanent}
              onExpiresAtChange={setExpiresAt}
              onCvesChange={setCves}
            />
          </fieldset>
        </section>
        {scannerError ? (
          <div className="warning-banner settings-warning">
            <Icon name="alert" />
            <span>
              {t("扫描器配置载入失败")}：{scannerError}
            </span>
          </div>
        ) : null}
      </form>
      <section className="danger-zone">
        <div>
          <h2>{t("删除项目")}</h2>
          <p>{project.name}</p>
        </div>
        <button
          className="button button-small button-danger"
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
