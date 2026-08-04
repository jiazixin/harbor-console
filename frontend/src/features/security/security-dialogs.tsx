import { useEffect, useState } from "react";

import { controlApi } from "../../app/api-client";
import { formatDate, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  CveAllowlist,
  CveExportExecution,
  ProjectSummary,
  ScannerMetadata,
  ScannerRegistration,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { CveAllowlistEditor } from "../../components/cve-allowlist-editor";
import { Icon } from "../../components/icons";
import { StatusBadge, triggerLabel } from "../../components/status-badge";
import { UnifiedSelect } from "../../components/unified-select";

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function expirationInput(value: number | null | undefined): string {
  if (!value) return "";
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function parseCves(value: string): { cve_id: string }[] {
  const values = [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  const invalid = values.find((item) => !/^CVE-\d{4}-\d{4,}$/.test(item));
  if (invalid)
    throw new Error(`CVE 编号 ${invalid} 格式无效，应类似 CVE-2026-1842`);
  if (values.length > 1000) throw new Error("CVE 白名单最多包含 1000 项");
  return values.map((cve_id) => ({ cve_id }));
}

export function ScannerDialog({
  scanner,
  canDisable = true,
  onClose,
  onSaved,
}: {
  scanner?: ScannerRegistration;
  canDisable?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [auth, setAuth] = useState(scanner?.auth ?? "");
  const disableUnavailable = scanner?.is_default === true || !canDisable;
  return (
    <ControlDialog
      title={scanner ? "编辑扫描器" : "注册扫描器"}
      subtitle="兼容 Harbor Scanner Adapter API"
      submitLabel={scanner ? "保存扫描器" : "注册扫描器"}
      onClose={onClose}
      onSubmit={async (formData) => {
        await controlApi.mutate(
          scanner ? "scanner" : "scanners",
          scanner ? { id: scanner.uuid } : {},
          scanner ? "PUT" : "POST",
          {
            name: formString(formData, "name"),
            description: formString(formData, "description"),
            url: formString(formData, "url"),
            auth: formString(formData, "auth"),
            access_credential: formString(formData, "access_credential"),
            disabled: disableUnavailable ? false : formData.has("disabled"),
            skip_certVerify: formData.has("skip_cert_verify"),
            use_internal_addr: formData.has("use_internal_addr"),
          },
        );
        onSaved();
      }}
    >
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("名称")}</span>
          <input
            name="name"
            required
            maxLength={128}
            defaultValue={scanner?.name}
          />
        </label>
        <label className="field">
          <span>{t("认证方式")}</span>
          <UnifiedSelect
            name="auth"
            ariaLabel={t("认证方式")}
            value={auth}
            options={[
              { value: "", label: t("无认证") },
              { value: "Basic", label: "Basic" },
              { value: "Bearer", label: "Bearer" },
              { value: "X-ScannerAdapter-API-Key", label: "API Key" },
            ]}
            onChange={setAuth}
          />
        </label>
        <label className="field field-span">
          <span>{t("适配器地址")}</span>
          <input
            name="url"
            type="url"
            required
            maxLength={512}
            defaultValue={scanner?.url}
            placeholder="http://scanner-adapter:8080"
          />
        </label>
        <label className="field field-span">
          <span>{t("访问凭据")}</span>
          <input
            name="access_credential"
            type="password"
            maxLength={512}
            autoComplete="new-password"
            placeholder={t(
              scanner ? "留空保留原凭据" : "认证方式为无认证时可留空",
            )}
          />
        </label>
        <label className="field field-span">
          <span>{t("描述")}</span>
          <textarea
            name="description"
            rows={3}
            maxLength={1024}
            defaultValue={scanner?.description}
          />
        </label>
      </div>
      <div className="check-grid">
        <label className="check-row">
          <input
            name="disabled"
            type="checkbox"
            defaultChecked={disableUnavailable ? false : scanner?.disabled}
            disabled={disableUnavailable}
          />
          <span>
            <strong>{t("停用扫描器")}</strong>
          </span>
        </label>
        <label className="check-row">
          <input
            name="skip_cert_verify"
            type="checkbox"
            defaultChecked={scanner?.skip_certVerify}
          />
          <span>
            <strong>{t("跳过 TLS 验证")}</strong>
          </span>
        </label>
        <label className="check-row">
          <input
            name="use_internal_addr"
            type="checkbox"
            defaultChecked={scanner?.use_internal_addr}
          />
          <span>
            <strong>{t("使用内部仓库地址")}</strong>
          </span>
        </label>
      </div>
    </ControlDialog>
  );
}

export function DeleteScannerDialog({
  scanner,
  onClose,
  onDeleted,
}: {
  scanner: ScannerRegistration;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  return (
    <ControlDialog
      title="删除扫描器"
      subtitle={
        locale === "en-US"
          ? `Scanner ${scanner.name ?? scanner.uuid} will be unregistered from Harbor.`
          : `扫描器 ${scanner.name ?? scanner.uuid} 将从 Harbor 中注销。`
      }
      submitLabel="删除扫描器"
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (formString(formData, "confirmation") !== (scanner.name ?? ""))
          throw new Error(t("输入内容与资源名称不一致"));
        await controlApi.mutate("scanner", { id: scanner.uuid }, "DELETE");
        onDeleted();
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
      <label className="field">
        <span>{t("输入资源名称确认")}</span>
        <input
          name="confirmation"
          required
          autoComplete="off"
          placeholder={scanner.name}
        />
      </label>
    </ControlDialog>
  );
}

function ScannerMetadataContent({ metadata }: { metadata: ScannerMetadata }) {
  const { locale, t } = useLocale();
  const scanner = metadata.scanner ?? {};
  const capabilities = metadata.capabilities ?? [];
  const properties = Object.entries(metadata.properties ?? {});
  const scannerDetails = [scanner.vendor, scanner.version]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  return (
    <div className="scanner-metadata-layout">
      <section className="scanner-metadata-summary">
        <div>
          <h3>{scanner.name ?? t("未知扫描器")}</h3>
          <p>{scannerDetails ? scannerDetails : "Harbor Scanner Adapter"}</p>
        </div>
        <span className="badge badge-green">{t("官方元数据")}</span>
      </section>
      <section>
        <div className="directory-result-head">
          <span>{t("扫描能力")}</span>
          <span>
            {locale === "en-US"
              ? `${formatNumber(capabilities.length, locale)} items`
              : `${formatNumber(capabilities.length, locale)} 项`}
          </span>
        </div>
        {capabilities.length ? (
          <div className="scanner-capability-list">
            {capabilities.map((capability, index) => (
              <article
                key={`${capability.type ?? "unknown"}-${String(index)}`}
                className="scanner-capability"
              >
                <header>
                  <strong>
                    {t(
                      capability.type === "vulnerability"
                        ? "漏洞扫描"
                        : capability.type === "sbom"
                          ? "SBOM 生成"
                          : "自定义能力",
                    )}
                  </strong>
                  <code>{capability.type ?? "unknown"}</code>
                </header>
                <dl>
                  <div>
                    <dt>{t("输入 MIME 类型")}</dt>
                    <dd>
                      {capability.consumes_mime_types?.length ? (
                        <span className="scanner-mime-list">
                          {capability.consumes_mime_types.map((value) => (
                            <code key={value}>{value}</code>
                          ))}
                        </span>
                      ) : (
                        <span className="muted">{t("未声明")}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("输出 MIME 类型")}</dt>
                    <dd>
                      {capability.produces_mime_types?.length ? (
                        <span className="scanner-mime-list">
                          {capability.produces_mime_types.map((value) => (
                            <code key={value}>{value}</code>
                          ))}
                        </span>
                      ) : (
                        <span className="muted">{t("未声明")}</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className="directory-state">
            <Icon name="info" />
            <div>
              <strong>{t("未声明扫描能力")}</strong>
              <span>{t("扫描器元数据没有返回 capabilities。")}</span>
            </div>
          </div>
        )}
      </section>
      <section>
        <div className="directory-result-head">
          <span>{t("自定义属性")}</span>
          <span>
            {locale === "en-US"
              ? `${formatNumber(properties.length, locale)} items`
              : `${formatNumber(properties.length, locale)} 项`}
          </span>
        </div>
        {properties.length ? (
          <dl className="scanner-property-list">
            {properties.map(([key, value]) => (
              <div key={key}>
                <dt className="mono">{key}</dt>
                <dd className="mono">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="directory-state compact">
            <Icon name="info" />
            <div>
              <strong>{t("没有自定义属性")}</strong>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export function ScannerMetadataDialog({
  scanner,
  onClose,
}: {
  scanner: ScannerRegistration;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [metadata, setMetadata] = useState<ScannerMetadata>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void controlApi
      .data<ScannerMetadata>(
        "scanner-metadata",
        { id: scanner.uuid },
        controller.signal,
      )
      .then((value) => setMetadata(value ?? {}))
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      });
    return () => controller.abort();
  }, [scanner.uuid]);
  return (
    <ControlDialog
      title="扫描器元数据"
      subtitle={scanner.name ?? scanner.uuid}
      submitLabel="关闭"
      showCancel={false}
      dialogClass="control-dialog-large"
      initialFocusSelector={null}
      onClose={onClose}
      onSubmit={() => {
        onClose();
        return Promise.resolve();
      }}
    >
      {!metadata && !error ? (
        <div className="dialog-loading">
          <span className="spinner" />
          <span>{t("正在读取扫描器元数据...")}</span>
        </div>
      ) : null}
      {error ? (
        <div className="directory-state directory-state-error">
          <Icon name="alert" />
          <div>
            <strong>{t("扫描器元数据载入失败")}</strong>
            <span>{error}</span>
          </div>
        </div>
      ) : null}
      {metadata ? <ScannerMetadataContent metadata={metadata} /> : null}
    </ControlDialog>
  );
}

export function SystemAllowlistDialog({
  allowlist,
  onClose,
  onSaved,
}: {
  allowlist: CveAllowlist;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [permanent, setPermanent] = useState(!allowlist.expires_at);
  const [expiresAt, setExpiresAt] = useState(
    expirationInput(allowlist.expires_at),
  );
  const [cves, setCves] = useState(
    (allowlist.items ?? [])
      .map((item) => item.cve_id)
      .filter(Boolean)
      .join("\n"),
  );
  return (
    <ControlDialog
      title="编辑系统 CVE 白名单"
      subtitle="对使用系统白名单的全部项目生效"
      submitLabel="保存白名单"
      onClose={onClose}
      onSubmit={async () => {
        if (!permanent && !expiresAt)
          throw new Error("非永久白名单必须选择到期日期");
        const timestamp = permanent
          ? null
          : Math.floor(new Date(`${expiresAt}T23:59:59`).getTime() / 1000);
        if (!permanent && !Number.isFinite(timestamp))
          throw new Error("白名单到期日期无效");
        await controlApi.mutate("system-cve-allowlist", {}, "PUT", {
          expires_at: timestamp,
          items: parseCves(cves),
        });
        onSaved();
      }}
    >
      <CveAllowlistEditor
        permanent={permanent}
        expiresAt={expiresAt}
        cves={cves}
        onPermanentChange={setPermanent}
        onExpiresAtChange={setExpiresAt}
        onCvesChange={setCves}
      />
    </ControlDialog>
  );
}

export function CveExportDialog({
  projects,
  onClose,
  onCreated,
}: {
  projects: ProjectSummary[];
  onClose: () => void;
  onCreated: (id: number | undefined) => void;
}) {
  const { t } = useLocale();
  const [projectId, setProjectId] = useState(() =>
    String(projects[0]?.project_id ?? ""),
  );
  return (
    <ControlDialog
      title="新建 CVE 导出"
      subtitle="Harbor 当前一次导出一个项目的扫描数据"
      submitLabel="创建导出任务"
      onClose={onClose}
      onSubmit={async (formData) => {
        const selectedProjectId = Number(formString(formData, "project"));
        if (!Number.isInteger(selectedProjectId) || selectedProjectId <= 0) {
          throw new Error(t("请选择项目"));
        }
        const labels = formString(formData, "labels")
          .split(/[\s,]+/)
          .filter(Boolean)
          .map(Number);
        if (labels.some((value) => !Number.isInteger(value) || value <= 0))
          throw new Error(t("标签 ID 必须是用逗号分隔的正整数"));
        const payload: Record<string, unknown> = {
          projects: [selectedProjectId],
          labels,
        };
        ["job_name", "repositories", "cveIds", "tags"].forEach((key) => {
          const value = formString(formData, key);
          if (value) payload[key] = value;
        });
        const result = await controlApi.mutate<{ data?: { id?: number } }>(
          "cve-export",
          {},
          "POST",
          payload,
        );
        onCreated(result.data?.id);
      }}
    >
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("项目")}</span>
          <UnifiedSelect
            ariaLabel={t("项目")}
            name="project"
            value={projectId}
            options={projects.map((project) => ({
              value: String(project.project_id ?? ""),
              label: project.name,
              disabled: !project.project_id,
            }))}
            onChange={setProjectId}
          />
        </label>
        <label className="field">
          <span>{t("任务名称")}</span>
          <input
            name="job_name"
            maxLength={255}
            placeholder={t("例如 月度漏洞审计")}
          />
        </label>
        <label className="field">
          <span>{t("仓库匹配")}</span>
          <input
            name="repositories"
            maxLength={2048}
            placeholder="例如 platform/**"
          />
        </label>
        <label className="field">
          <span>{t("Tag 匹配")}</span>
          <input name="tags" maxLength={2048} placeholder="例如 release-*" />
        </label>
        <label className="field">
          <span>{t("CVE 编号")}</span>
          <input
            name="cveIds"
            maxLength={2048}
            placeholder={t("多个编号按 Harbor 查询语法填写")}
          />
        </label>
        <label className="field">
          <span>{t("标签 ID")}</span>
          <input name="labels" maxLength={512} placeholder="例如 12,18" />
        </label>
      </div>
    </ControlDialog>
  );
}

export function CveExportDetailDialog({
  execution,
  onClose,
}: {
  execution: CveExportExecution;
  onClose: () => void;
}) {
  const { locale, t } = useLocale();
  return (
    <ControlDialog
      title={`导出执行 #${String(execution.id)}`}
      subtitle="Harbor JobService 返回的执行详情"
      submitLabel="关闭"
      showCancel={false}
      onClose={onClose}
      onSubmit={() => {
        onClose();
        return Promise.resolve();
      }}
    >
      <dl className="definition-list export-detail-list">
        <div>
          <dt>{t("状态")}</dt>
          <dd>
            <StatusBadge status={execution.status} />
          </dd>
        </div>
        <div>
          <dt>{t("发起人")}</dt>
          <dd>
            {execution.user_name ??
              `${t("用户")} #${String(execution.user_id ?? "-")}`}
          </dd>
        </div>
        <div>
          <dt>{t("触发方式")}</dt>
          <dd>{triggerLabel(execution.trigger, t)}</dd>
        </div>
        <div>
          <dt>{t("开始时间")}</dt>
          <dd>{formatDate(execution.start_time, locale)}</dd>
        </div>
        <div>
          <dt>{t("结束时间")}</dt>
          <dd>{formatDate(execution.end_time, locale)}</dd>
        </div>
        <div>
          <dt>{t("状态详情")}</dt>
          <dd>{execution.status_text ?? t("暂无附加信息")}</dd>
        </div>
      </dl>
    </ControlDialog>
  );
}
