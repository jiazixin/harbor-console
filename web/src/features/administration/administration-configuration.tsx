import { ContentTransition } from "../../components/content-transition";
import { type FormEvent, useMemo, useState } from "react";

import { globalAuditOperationLabel } from "../../app/audit-log";
import { controlApi } from "../../app/api-client";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type {
  CveAllowlist,
  HarborConfiguration,
  HarborConfigurationItem,
} from "../../app/models";
import { CveAllowlistEditor } from "../../components/cve-allowlist-editor";
import { Icon } from "../../components/icons";
import { ToggleSetting } from "../../components/toggle-setting";
import { UnifiedSelect } from "../../components/unified-select";

type AuthenticationMode =
  "db_auth" | "http_auth" | "ldap_auth" | "oidc_auth" | "uaa_auth";

type ConfigurationTab = "auth" | "security" | "system";

export type ConfigurationData = {
  section: "configuration";
  configuration: HarborConfiguration;
  allowlist?: CveAllowlist;
  allowlistError?: string;
  auditEvents: string[];
  auditEventsError?: string;
};

type ConfigurationPayload = Record<string, boolean | number | string>;

const authenticationModes = new Set<AuthenticationMode>([
  "db_auth",
  "ldap_auth",
  "uaa_auth",
  "oidc_auth",
  "http_auth",
]);

const authenticationFields: Record<
  Exclude<AuthenticationMode, "db_auth">,
  Record<string, "boolean" | "number" | "secret" | "string">
> = {
  ldap_auth: {
    ldap_url: "string",
    ldap_timeout: "number",
    ldap_search_dn: "string",
    ldap_search_password: "secret",
    ldap_base_dn: "string",
    ldap_filter: "string",
    ldap_uid: "string",
    ldap_scope: "number",
    ldap_group_base_dn: "string",
    ldap_group_search_filter: "string",
    ldap_group_attribute_name: "string",
    ldap_group_admin_dn: "string",
    ldap_group_membership_attribute: "string",
    ldap_group_search_scope: "number",
    ldap_group_attach_parallel: "boolean",
    ldap_verify_cert: "boolean",
  },
  uaa_auth: {
    uaa_endpoint: "string",
    uaa_client_id: "string",
    uaa_client_secret: "secret",
    uaa_verify_cert: "boolean",
  },
  http_auth: {
    http_authproxy_endpoint: "string",
    http_authproxy_tokenreview_endpoint: "string",
    http_authproxy_admin_groups: "string",
    http_authproxy_admin_usernames: "string",
    http_authproxy_verify_cert: "boolean",
    http_authproxy_skip_search: "boolean",
    http_authproxy_server_certificate: "string",
  },
  oidc_auth: {
    oidc_name: "string",
    oidc_endpoint: "string",
    oidc_client_id: "string",
    oidc_client_secret: "secret",
    oidc_groups_claim: "string",
    oidc_admin_group: "string",
    oidc_group_filter: "string",
    oidc_scope: "string",
    oidc_user_claim: "string",
    oidc_extra_redirect_parms: "string",
    oidc_verify_cert: "boolean",
    oidc_auto_onboard: "boolean",
    oidc_logout: "boolean",
  },
};

function configurationItem(
  configuration: HarborConfiguration,
  key: string,
): HarborConfigurationItem | undefined {
  const value = configuration[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : undefined;
}

function configurationValue(
  configuration: HarborConfiguration,
  key: string,
): unknown {
  const item = configurationItem(configuration, key);
  return item && Object.hasOwn(item, "value") ? item.value : configuration[key];
}

function configurationEditable(
  configuration: HarborConfiguration,
  key: string,
): boolean {
  return configurationItem(configuration, key)?.editable !== false;
}

function configurationString(
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

function configurationBoolean(
  configuration: HarborConfiguration,
  key: string,
): boolean {
  return Boolean(configurationValue(configuration, key));
}

function authenticationMode(configuration: HarborConfiguration) {
  const value = configurationString(configuration, "auth_mode", "db_auth");
  return authenticationModes.has(value as AuthenticationMode)
    ? (value as AuthenticationMode)
    : "db_auth";
}

function formString(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function addEditable(
  payload: ConfigurationPayload,
  configuration: HarborConfiguration,
  key: string,
  value: boolean | number | string,
  skipEmpty = false,
) {
  if (!configurationEditable(configuration, key)) return;
  if (skipEmpty && String(value).trim() === "") return;
  payload[key] = value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ConfigurationTextField({
  configuration,
  configKey,
  label,
  type = "text",
  required = false,
  min,
  max,
  placeholder,
  value,
  disabled = false,
  className,
}: {
  configuration: HarborConfiguration;
  configKey: string;
  label: string;
  type?: "number" | "password" | "text" | "url";
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  value?: string | number;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useLocale();
  const locked = !configurationEditable(configuration, configKey);
  return (
    <label className={`field${className ? ` ${className}` : ""}`}>
      <span>{t(label)}</span>
      <input
        name={configKey}
        type={type}
        required={required}
        min={min}
        max={max}
        step={type === "number" ? 1 : undefined}
        placeholder={placeholder ? t(placeholder) : undefined}
        defaultValue={
          value ?? configurationString(configuration, configKey, "")
        }
        disabled={locked || disabled}
        data-config-locked={locked ? "true" : undefined}
      />
    </label>
  );
}

function ConfigurationScopeField({
  configuration,
  configKey,
  label,
}: {
  configuration: HarborConfiguration;
  configKey: string;
  label: string;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState(
    configurationString(configuration, configKey, "0"),
  );
  return (
    <label className="field">
      <span>{t(label)}</span>
      <UnifiedSelect
        ariaLabel={t(label)}
        name={configKey}
        value={value}
        disabled={!configurationEditable(configuration, configKey)}
        options={[
          { value: "0", label: "Base" },
          { value: "1", label: t("单层") },
          { value: "2", label: t("子树") },
        ]}
        onChange={setValue}
      />
    </label>
  );
}

function ConfigurationToggle({
  configuration,
  configKey,
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  configuration: HarborConfiguration;
  configKey: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  return (
    <ToggleSetting
      name={configKey}
      title={t(title)}
      description={t(description)}
      checked={checked}
      disabled={disabled || !configurationEditable(configuration, configKey)}
      onChange={onChange}
    />
  );
}

function ConfigurationGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  return (
    <section className="configuration-group">
      <div className="configuration-group-head">
        <h3>{t(title)}</h3>
        <p>{t(description)}</p>
      </div>
      {children}
    </section>
  );
}

function AuthenticationConfiguration({
  configuration,
  onReload,
  onNotice,
}: {
  configuration: HarborConfiguration;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const initialMode = authenticationMode(configuration);
  const [mode, setMode] = useState<AuthenticationMode>(initialMode);
  const [busy, setBusy] = useState<"save" | "test">();
  const [toggles, setToggles] = useState(() => ({
    primary_auth_mode: configurationBoolean(configuration, "primary_auth_mode"),
    self_registration: configurationBoolean(configuration, "self_registration"),
    ldap_group_attach_parallel: configurationBoolean(
      configuration,
      "ldap_group_attach_parallel",
    ),
    ldap_verify_cert: configurationBoolean(configuration, "ldap_verify_cert"),
    uaa_verify_cert: configurationBoolean(configuration, "uaa_verify_cert"),
    http_authproxy_verify_cert: configurationBoolean(
      configuration,
      "http_authproxy_verify_cert",
    ),
    http_authproxy_skip_search: configurationBoolean(
      configuration,
      "http_authproxy_skip_search",
    ),
    oidc_verify_cert: configurationBoolean(configuration, "oidc_verify_cert"),
    oidc_auto_onboard: configurationBoolean(configuration, "oidc_auto_onboard"),
    oidc_logout: configurationBoolean(configuration, "oidc_logout"),
  }));
  const setToggle = (key: keyof typeof toggles, value: boolean) =>
    setToggles((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget);
    const payload: ConfigurationPayload = {};
    addEditable(payload, configuration, "auth_mode", mode);
    addEditable(
      payload,
      configuration,
      "primary_auth_mode",
      mode !== "db_auth" && data.has("primary_auth_mode"),
    );
    if (mode !== "db_auth") {
      Object.entries(authenticationFields[mode]).forEach(([key, type]) => {
        const value =
          type === "boolean"
            ? data.has(key)
            : type === "number"
              ? Number(data.get(key))
              : formString(data, key);
        addEditable(payload, configuration, key, value, type === "secret");
      });
    }
    setBusy("save");
    try {
      await controlApi.mutate("configurations", {}, "PUT", payload);
      onNotice(t("认证配置已保存"));
      onReload();
    } catch (error) {
      onNotice(errorMessage(error), true);
      setBusy(undefined);
    }
  };

  const testConnection = async (form: HTMLFormElement) => {
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    setBusy("test");
    try {
      if (mode === "ldap_auth") {
        const result = await controlApi.mutate<{
          data?: { message?: string; success?: boolean };
        }>("ldap-ping", {}, "POST", {
          ldap_url: formString(data, "ldap_url"),
          ldap_search_dn: formString(data, "ldap_search_dn"),
          ldap_search_password:
            typeof data.get("ldap_search_password") === "string"
              ? (data.get("ldap_search_password") as string)
              : "",
          ldap_base_dn: formString(data, "ldap_base_dn"),
          ldap_filter: formString(data, "ldap_filter"),
          ldap_uid: formString(data, "ldap_uid"),
          ldap_scope: Number(data.get("ldap_scope")),
          ldap_connection_timeout: Number(data.get("ldap_timeout")),
          ldap_verify_cert: data.has("ldap_verify_cert"),
        });
        if (result.data?.success === false)
          throw new Error(result.data.message ?? t("LDAP 服务测试失败"));
        onNotice(result.data?.message ?? t("LDAP 服务连接成功"));
      } else if (mode === "oidc_auth") {
        await controlApi.mutate("oidc-ping", {}, "POST", {
          url: formString(data, "oidc_endpoint"),
          verify_cert: data.has("oidc_verify_cert"),
        });
        onNotice(t("OIDC 服务连接成功"));
      }
    } catch (error) {
      onNotice(errorMessage(error), true);
    } finally {
      setBusy(undefined);
    }
  };

  const externalAuthentication = mode !== "db_auth";
  return (
    <form
      className="settings-form configuration-form"
      onSubmit={(event) => void submit(event)}
    >
      <div className="section-heading">
        <div>
          <h2>{t("认证配置")}</h2>
          <p>{t("Harbor 官方认证模式与身份提供方参数")}</p>
        </div>
        <div className="configuration-actions">
          {mode === "ldap_auth" || mode === "oidc_auth" ? (
            <button
              className="button button-small"
              type="button"
              disabled={Boolean(busy)}
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (form) void testConnection(form);
              }}
            >
              {busy === "test" ? (
                <span className="spinner spinner-small" aria-hidden="true" />
              ) : (
                <Icon name="refresh" />
              )}
              <span>{t(busy === "test" ? "正在测试" : "测试连接")}</span>
            </button>
          ) : null}
          <button
            className="button button-small button-primary"
            type="submit"
            disabled={Boolean(busy)}
          >
            {busy === "save" ? (
              <span className="spinner spinner-small" aria-hidden="true" />
            ) : (
              <Icon name="check" />
            )}
            <span>{t(busy === "save" ? "正在保存" : "保存认证配置")}</span>
          </button>
        </div>
      </div>
      <ConfigurationGroup
        title="认证模式"
        description="切换模式后填写对应的身份提供方参数"
      >
        <div className="form-grid two-columns">
          <label className="field">
            <span>{t("认证模式")}</span>
            <UnifiedSelect
              ariaLabel={t("认证模式")}
              name="auth_mode"
              value={mode}
              disabled={!configurationEditable(configuration, "auth_mode")}
              options={[
                { value: "db_auth", label: t("数据库") },
                { value: "ldap_auth", label: "LDAP" },
                { value: "uaa_auth", label: "UAA" },
                { value: "oidc_auth", label: "OIDC" },
                { value: "http_auth", label: t("HTTP 认证代理") },
              ]}
              onChange={(nextMode) => {
                setMode(nextMode);
                if (nextMode === "db_auth")
                  setToggle("primary_auth_mode", false);
              }}
            />
          </label>
          {externalAuthentication ? (
            <div data-auth-common="external">
              <ConfigurationToggle
                configuration={configuration}
                configKey="primary_auth_mode"
                title="设为主认证模式"
                description="优先使用外部身份提供方认证"
                checked={toggles.primary_auth_mode}
                onChange={(value) => setToggle("primary_auth_mode", value)}
              />
            </div>
          ) : (
            <div data-auth-common="db">
              <ToggleSetting
                name="self_registration"
                title={t("开放用户注册（只读）")}
                description={t("Harbor v2.15.2 中为只读配置，仅显示当前状态")}
                checked={toggles.self_registration}
                disabled
                onChange={() => undefined}
              />
            </div>
          )}
        </div>
      </ConfigurationGroup>
      {mode === "ldap_auth" ? (
        <ConfigurationGroup
          title="LDAP 服务"
          description="用户和用户组目录连接"
        >
          <div className="form-grid two-columns">
            <ConfigurationTextField
              configuration={configuration}
              configKey="ldap_url"
              label="LDAP 地址"
              required
              placeholder="ldaps://ldap.example.com:636"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="ldap_timeout"
              label="连接超时（秒）"
              type="number"
              required
              min={1}
              value={configurationString(configuration, "ldap_timeout", "5")}
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="ldap_search_dn"
              label="搜索 DN"
              placeholder="cn=harbor,ou=services,dc=example,dc=com"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="ldap_search_password"
              label="搜索密码"
              type="password"
              value=""
              placeholder="留空保持现有密码"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="ldap_base_dn"
              label="用户 Base DN"
              required
              placeholder="ou=users,dc=example,dc=com"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="ldap_filter"
              label="用户搜索过滤器"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="ldap_uid"
              label="用户标识属性"
              required
              placeholder="uid"
            />
            <ConfigurationScopeField
              configuration={configuration}
              configKey="ldap_scope"
              label="用户搜索范围"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="ldap_group_base_dn"
              label="用户组 Base DN"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="ldap_group_search_filter"
              label="用户组搜索过滤器"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="ldap_group_attribute_name"
              label="用户组名称属性"
              placeholder="cn"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="ldap_group_admin_dn"
              label="管理员用户组 DN"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="ldap_group_membership_attribute"
              label="用户组成员属性"
              placeholder="memberOf"
            />
            <ConfigurationScopeField
              configuration={configuration}
              configKey="ldap_group_search_scope"
              label="用户组搜索范围"
            />
            <div>
              <ConfigurationToggle
                configuration={configuration}
                configKey="ldap_group_attach_parallel"
                title="并行关联用户组"
                description="使用并行工作线程读取用户组关系"
                checked={toggles.ldap_group_attach_parallel}
                onChange={(value) =>
                  setToggle("ldap_group_attach_parallel", value)
                }
              />
            </div>
            <div>
              <ConfigurationToggle
                configuration={configuration}
                configKey="ldap_verify_cert"
                title="验证 LDAP 证书"
                description="连接 LDAPS 时校验服务端证书"
                checked={toggles.ldap_verify_cert}
                onChange={(value) => setToggle("ldap_verify_cert", value)}
              />
            </div>
          </div>
        </ConfigurationGroup>
      ) : null}
      {mode === "uaa_auth" ? (
        <ConfigurationGroup
          title="UAA 服务"
          description="Cloud Foundry UAA 认证"
        >
          <div className="form-grid two-columns">
            <ConfigurationTextField
              configuration={configuration}
              configKey="uaa_endpoint"
              label="UAA 地址"
              type="url"
              required
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="uaa_client_id"
              label="客户端 ID"
              required
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="uaa_client_secret"
              label="客户端密钥"
              type="password"
              value=""
              required={initialMode !== "uaa_auth"}
              placeholder={
                initialMode === "uaa_auth"
                  ? "留空保持现有密钥"
                  : "首次启用 UAA 时必须填写"
              }
            />
            <div>
              <ConfigurationToggle
                configuration={configuration}
                configKey="uaa_verify_cert"
                title="验证 UAA 证书"
                description="校验 UAA 服务端 TLS 证书"
                checked={toggles.uaa_verify_cert}
                onChange={(value) => setToggle("uaa_verify_cert", value)}
              />
            </div>
          </div>
        </ConfigurationGroup>
      ) : null}
      {mode === "http_auth" ? (
        <ConfigurationGroup
          title="HTTP 认证代理"
          description="外部认证代理连接"
        >
          <div className="form-grid two-columns">
            <ConfigurationTextField
              configuration={configuration}
              configKey="http_authproxy_endpoint"
              label="登录地址"
              type="url"
              required
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="http_authproxy_tokenreview_endpoint"
              label="Token Review 地址"
              type="url"
              required
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="http_authproxy_admin_groups"
              label="管理员用户组"
              placeholder="多个值用逗号分隔"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="http_authproxy_admin_usernames"
              label="管理员用户名"
              placeholder="多个值用逗号分隔"
            />
            <div>
              <ConfigurationToggle
                configuration={configuration}
                configKey="http_authproxy_verify_cert"
                title="验证代理证书"
                description="校验认证代理的 TLS 证书"
                checked={toggles.http_authproxy_verify_cert}
                onChange={(value) =>
                  setToggle("http_authproxy_verify_cert", value)
                }
              />
            </div>
            <div>
              <ConfigurationToggle
                configuration={configuration}
                configKey="http_authproxy_skip_search"
                title="跳过用户搜索"
                description="添加成员时不预先搜索外部用户"
                checked={toggles.http_authproxy_skip_search}
                onChange={(value) =>
                  setToggle("http_authproxy_skip_search", value)
                }
              />
            </div>
            <label className="field field-span">
              <span>{t("服务端证书")}</span>
              <textarea
                name="http_authproxy_server_certificate"
                rows={5}
                defaultValue={configurationString(
                  configuration,
                  "http_authproxy_server_certificate",
                )}
                disabled={
                  !configurationEditable(
                    configuration,
                    "http_authproxy_server_certificate",
                  )
                }
              />
            </label>
          </div>
        </ConfigurationGroup>
      ) : null}
      {mode === "oidc_auth" ? (
        <ConfigurationGroup
          title="OIDC 提供方"
          description="OpenID Connect 单点登录"
        >
          <div className="form-grid two-columns">
            <ConfigurationTextField
              configuration={configuration}
              configKey="oidc_name"
              label="提供方名称"
              required
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="oidc_endpoint"
              label="OIDC 地址"
              type="url"
              required
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="oidc_client_id"
              label="客户端 ID"
              required
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="oidc_client_secret"
              label="客户端密钥"
              type="password"
              value=""
              required={initialMode !== "oidc_auth"}
              placeholder={
                initialMode === "oidc_auth"
                  ? "留空保持现有密钥"
                  : "首次启用 OIDC 时必须填写"
              }
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="oidc_groups_claim"
              label="用户组 Claim"
              placeholder="groups"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="oidc_admin_group"
              label="管理员用户组"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="oidc_group_filter"
              label="用户组过滤正则"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="oidc_scope"
              label="Scope"
              required
              placeholder="openid,profile,email,groups"
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="oidc_user_claim"
              label="用户名 Claim"
              placeholder="preferred_username"
              disabled={!toggles.oidc_auto_onboard}
            />
            <ConfigurationTextField
              configuration={configuration}
              configKey="oidc_extra_redirect_parms"
              label="额外重定向参数"
            />
            <div>
              <ConfigurationToggle
                configuration={configuration}
                configKey="oidc_verify_cert"
                title="验证 OIDC 证书"
                description="校验身份提供方的 TLS 证书"
                checked={toggles.oidc_verify_cert}
                onChange={(value) => setToggle("oidc_verify_cert", value)}
              />
            </div>
            <div>
              <ConfigurationToggle
                configuration={configuration}
                configKey="oidc_auto_onboard"
                title="自动创建用户"
                description="首次登录时自动加入 Harbor"
                checked={toggles.oidc_auto_onboard}
                onChange={(value) => {
                  setToggle("oidc_auto_onboard", value);
                }}
              />
            </div>
            <div>
              <ConfigurationToggle
                configuration={configuration}
                configKey="oidc_logout"
                title="联动退出 OIDC"
                description="退出 Harbor 时同时结束 OIDC 会话"
                checked={toggles.oidc_logout}
                onChange={(value) => setToggle("oidc_logout", value)}
              />
            </div>
          </div>
        </ConfigurationGroup>
      ) : null}
    </form>
  );
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

function SecurityConfiguration({
  allowlist,
  loadError,
  onReload,
  onNotice,
}: {
  allowlist?: CveAllowlist;
  loadError?: string;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const [permanent, setPermanent] = useState(!allowlist?.expires_at);
  const [expiresAt, setExpiresAt] = useState(
    expirationInput(allowlist?.expires_at),
  );
  const [cves, setCves] = useState(
    (allowlist?.items ?? [])
      .map((item) => item.cve_id)
      .filter(Boolean)
      .join("\n"),
  );
  const [busy, setBusy] = useState(false);
  if (loadError) {
    return (
      <div className="warning-banner">
        <Icon name="alert" />
        <span>
          {t("系统 CVE 白名单载入失败")}：{loadError}
        </span>
      </div>
    );
  }
  return (
    <form
      className="settings-form configuration-form"
      onSubmit={(event) => {
        event.preventDefault();
        void (async () => {
          try {
            if (!permanent && !expiresAt)
              throw new Error(t("非永久白名单必须选择到期日期"));
            const timestamp = permanent
              ? null
              : Math.floor(new Date(`${expiresAt}T23:59:59`).getTime() / 1000);
            if (!permanent && !Number.isFinite(timestamp))
              throw new Error(t("白名单到期日期无效"));
            setBusy(true);
            await controlApi.mutate("system-cve-allowlist", {}, "PUT", {
              expires_at: timestamp,
              items: parseCves(cves),
            });
            onNotice(t("安全配置已保存"));
            onReload();
          } catch (error) {
            onNotice(errorMessage(error), true);
            setBusy(false);
          }
        })();
      }}
    >
      <div className="section-heading">
        <div>
          <h2>{t("系统 CVE 白名单")}</h2>
          <p>{t("对应 Harbor 原版配置管理中的安全页面")}</p>
        </div>
        <button
          className="button button-small button-primary"
          type="submit"
          disabled={busy}
        >
          {busy ? (
            <span className="spinner spinner-small" aria-hidden="true" />
          ) : (
            <Icon name="check" />
          )}
          <span>{t(busy ? "正在保存" : "保存安全配置")}</span>
        </button>
      </div>
      <section className="configuration-group">
        <CveAllowlistEditor
          permanent={permanent}
          expiresAt={expiresAt}
          cves={cves}
          onPermanentChange={setPermanent}
          onExpiresAtChange={setExpiresAt}
          onCvesChange={setCves}
        />
      </section>
    </form>
  );
}

type BannerConfiguration = {
  message: string;
  type: "danger" | "info" | "success" | "warning";
  closable: boolean;
  fromDate: string;
  toDate: string;
};

function bannerConfiguration(value: unknown): BannerConfiguration {
  try {
    const parsed: unknown = JSON.parse(typeof value === "string" ? value : "");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Invalid banner configuration");
    const record = parsed as Record<string, unknown>;
    const type =
      typeof record.type === "string" &&
      ["danger", "info", "success", "warning"].includes(record.type)
        ? (record.type as BannerConfiguration["type"])
        : "warning";
    return {
      message: typeof record.message === "string" ? record.message : "",
      type,
      closable: Boolean(record.closable),
      fromDate:
        typeof record.fromDate === "string" ? record.fromDate.slice(0, 10) : "",
      toDate:
        typeof record.toDate === "string" ? record.toDate.slice(0, 10) : "",
    };
  } catch {
    return {
      message: "",
      type: "warning",
      closable: false,
      fromDate: "",
      toDate: "",
    };
  }
}

function storageGigabytes(value: unknown): number {
  const bytes = Number(value);
  if (bytes < 0) return -1;
  return Number((bytes / 1024 ** 3).toFixed(2));
}

function SystemConfiguration({
  configuration,
  auditEvents,
  auditEventsError,
  hasRootCertificate,
  onReload,
  onNotice,
}: {
  configuration: HarborConfiguration;
  auditEvents: string[];
  auditEventsError?: string;
  hasRootCertificate: boolean;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [projectCreationRestriction, setProjectCreationRestriction] = useState(
    configurationString(
      configuration,
      "project_creation_restriction",
      "adminonly",
    ),
  );
  const [toggles, setToggles] = useState(() => ({
    read_only: configurationBoolean(configuration, "read_only"),
    notification_enable: configurationBoolean(
      configuration,
      "notification_enable",
    ),
    scanner_skip_update_pulltime: configurationBoolean(
      configuration,
      "scanner_skip_update_pulltime",
    ),
    quota_per_project_enable: configurationBoolean(
      configuration,
      "quota_per_project_enable",
    ),
    skip_audit_log_database: configurationBoolean(
      configuration,
      "skip_audit_log_database",
    ),
  }));
  const [auditEndpoint, setAuditEndpoint] = useState(
    configurationString(configuration, "audit_log_forward_endpoint"),
  );
  const [banner, setBanner] = useState(() =>
    bannerConfiguration(configurationValue(configuration, "banner_message")),
  );
  const disabledAuditEvents = useMemo(
    () =>
      new Set(
        configurationString(configuration, "disabled_audit_log_event_types")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    [configuration],
  );
  const [enabledAuditEvents, setEnabledAuditEvents] = useState(
    () =>
      new Set(auditEvents.filter((event) => !disabledAuditEvents.has(event))),
  );
  const setToggle = (key: keyof typeof toggles, value: boolean) =>
    setToggles((current) => ({ ...current, [key]: value }));
  const bannerLocked = !configurationEditable(configuration, "banner_message");
  const bannerEnabled = Boolean(banner.message.trim());

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget);
    const payload: ConfigurationPayload = {};
    [
      "project_creation_restriction",
      "robot_name_prefix",
      "audit_log_forward_endpoint",
    ].forEach((key) =>
      addEditable(payload, configuration, key, formString(data, key)),
    );
    ["token_expiration", "session_timeout", "robot_token_duration"].forEach(
      (key) => addEditable(payload, configuration, key, Number(data.get(key))),
    );
    [
      "read_only",
      "notification_enable",
      "scanner_skip_update_pulltime",
      "quota_per_project_enable",
      "skip_audit_log_database",
    ].forEach((key) => addEditable(payload, configuration, key, data.has(key)));
    const storageGB = Number(data.get("storage_per_project_gb"));
    if (!Number.isInteger(storageGB) || (storageGB !== -1 && storageGB <= 0)) {
      onNotice(t("默认项目配额必须是 -1 或正整数"), true);
      return;
    }
    addEditable(
      payload,
      configuration,
      "storage_per_project",
      storageGB === -1 ? -1 : storageGB * 1024 ** 3,
    );
    if (auditEvents.length) {
      addEditable(
        payload,
        configuration,
        "disabled_audit_log_event_types",
        auditEvents
          .filter((eventName) => !enabledAuditEvents.has(eventName))
          .join(","),
      );
    }
    let bannerMessage = "";
    if (bannerEnabled) {
      if (banner.fromDate && banner.toDate && banner.fromDate > banner.toDate) {
        onNotice(t("横幅消息的结束日期不能早于开始日期"), true);
        return;
      }
      bannerMessage = JSON.stringify({
        message: banner.message.trim(),
        type: banner.type,
        closable: banner.closable,
        fromDate: banner.fromDate || null,
        toDate: banner.toDate || null,
      });
    }
    addEditable(payload, configuration, "banner_message", bannerMessage);
    setBusy(true);
    try {
      await controlApi.mutate("configurations", {}, "PUT", payload);
      onNotice(t("系统设置已保存"));
      onReload();
    } catch (error) {
      onNotice(errorMessage(error), true);
      setBusy(false);
    }
  };

  return (
    <form
      className="settings-form configuration-form"
      onSubmit={(event) => void submit(event)}
    >
      <div className="section-heading">
        <div>
          <h2>{t("系统设置")}</h2>
          <p>{t("项目创建、会话、机器人账号、审计和横幅消息")}</p>
        </div>
        <button
          className="button button-small button-primary"
          type="submit"
          disabled={busy}
        >
          {busy ? (
            <span className="spinner spinner-small" aria-hidden="true" />
          ) : (
            <Icon name="check" />
          )}
          <span>{t(busy ? "正在保存" : "保存系统设置")}</span>
        </button>
      </div>
      <ConfigurationGroup
        title="账号与项目"
        description="全局账号期限和项目创建规则"
      >
        <div className="form-grid two-columns">
          <label className="field">
            <span>{t("项目创建权限")}</span>
            <UnifiedSelect
              ariaLabel={t("项目创建权限")}
              name="project_creation_restriction"
              value={projectCreationRestriction}
              disabled={
                !configurationEditable(
                  configuration,
                  "project_creation_restriction",
                )
              }
              options={[
                { value: "adminonly", label: t("仅系统管理员") },
                { value: "everyone", label: t("所有用户") },
              ]}
              onChange={setProjectCreationRestriction}
            />
          </label>
          <ConfigurationTextField
            configuration={configuration}
            configKey="token_expiration"
            label="令牌有效期（分钟）"
            type="number"
            required
            min={1}
            max={9_999_999_999}
          />
          <ConfigurationTextField
            configuration={configuration}
            configKey="session_timeout"
            label="会话超时（分钟）"
            type="number"
            required
            min={1}
            max={9_999_999_999}
          />
          <ConfigurationTextField
            configuration={configuration}
            configKey="robot_name_prefix"
            label="机器人账号名称前缀"
            required
            placeholder="robot$"
          />
          <ConfigurationTextField
            configuration={configuration}
            configKey="robot_token_duration"
            label="机器人令牌有效期（天）"
            type="number"
            required
            min={1}
            max={9_999_999_999}
          />
        </div>
        {hasRootCertificate ? (
          <div className="system-certificate-row">
            <Icon name="external" />
            <span>
              <strong>{t("Harbor 根证书")}</strong>
              <small>
                {t("用于让 Docker、containerd 等客户端信任当前 Harbor 实例。")}
              </small>
            </span>
            <a
              className="button button-small"
              href="/api/control/system-root-certificate"
              download
            >
              <Icon name="external" />
              <span>{t("下载根证书")}</span>
            </a>
          </div>
        ) : null}
      </ConfigurationGroup>
      <ConfigurationGroup
        title="运行策略"
        description="写入、通知、扫描和默认配额"
      >
        <div className="settings-grid">
          <ConfigurationToggle
            configuration={configuration}
            configKey="read_only"
            title="只读模式"
            description="阻止制品推送、删除和复制写入"
            checked={toggles.read_only}
            onChange={(value) => setToggle("read_only", value)}
          />
          <ConfigurationToggle
            configuration={configuration}
            configKey="notification_enable"
            title="启用 Webhook 通知"
            description="允许 Harbor 发送事件通知"
            checked={toggles.notification_enable}
            onChange={(value) => setToggle("notification_enable", value)}
          />
          <ConfigurationToggle
            configuration={configuration}
            configKey="scanner_skip_update_pulltime"
            title="扫描不更新拉取时间"
            description="扫描器拉取制品时不修改拉取时间"
            checked={toggles.scanner_skip_update_pulltime}
            onChange={(value) =>
              setToggle("scanner_skip_update_pulltime", value)
            }
          />
          <ConfigurationToggle
            configuration={configuration}
            configKey="quota_per_project_enable"
            title="启用项目配额"
            description="为新建项目应用默认存储限制"
            checked={toggles.quota_per_project_enable}
            onChange={(value) => setToggle("quota_per_project_enable", value)}
          />
        </div>
        <div className="form-grid two-columns admin-config-fields">
          <label className="field">
            <span>{t("默认项目配额（GiB）")}</span>
            <input
              name="storage_per_project_gb"
              type="number"
              min={-1}
              step={1}
              defaultValue={storageGigabytes(
                configurationValue(configuration, "storage_per_project"),
              )}
              disabled={
                !configurationEditable(configuration, "storage_per_project")
              }
            />
            <small className="field-help">{t("输入 -1 表示不限制。")}</small>
          </label>
        </div>
      </ConfigurationGroup>
      <ConfigurationGroup
        title="审计日志"
        description="外部转发与数据库记录范围"
      >
        <div className="form-grid two-columns">
          <label className="field">
            <span>{t("审计日志转发地址")}</span>
            <input
              name="audit_log_forward_endpoint"
              type="url"
              placeholder="https://audit.example.com/events"
              value={auditEndpoint}
              disabled={
                !configurationEditable(
                  configuration,
                  "audit_log_forward_endpoint",
                )
              }
              onChange={(event) => {
                setAuditEndpoint(event.currentTarget.value);
                if (!event.currentTarget.value.trim())
                  setToggle("skip_audit_log_database", false);
              }}
            />
          </label>
          <div>
            <ConfigurationToggle
              configuration={configuration}
              configKey="skip_audit_log_database"
              title="跳过数据库审计日志"
              description="仅使用外部审计转发时启用"
              checked={toggles.skip_audit_log_database}
              disabled={!auditEndpoint.trim()}
              onChange={(value) => setToggle("skip_audit_log_database", value)}
            />
          </div>
        </div>
        {auditEventsError ? (
          <div className="warning-banner settings-warning">
            <Icon name="alert" />
            <span>
              {t("审计事件类型载入失败")}：{auditEventsError}
            </span>
          </div>
        ) : auditEvents.length ? (
          <fieldset
            className="audit-event-config"
            disabled={
              !configurationEditable(
                configuration,
                "disabled_audit_log_event_types",
              )
            }
          >
            <legend>{t("写入数据库的事件类型")}</legend>
            <div className="check-grid">
              {auditEvents.map((eventName) => (
                <label className="check-row" key={eventName}>
                  <input
                    name="enabled_audit_event"
                    type="checkbox"
                    value={eventName}
                    checked={enabledAuditEvents.has(eventName)}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setEnabledAuditEvents((current) => {
                        const next = new Set(current);
                        if (checked) next.add(eventName);
                        else next.delete(eventName);
                        return next;
                      });
                    }}
                  />
                  <span>
                    <strong>
                      {globalAuditOperationLabel(eventName, locale, t)}
                    </strong>
                    <small>{eventName}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
      </ConfigurationGroup>
      <ConfigurationGroup
        title="横幅消息"
        description="在控制台顶部向所有用户显示实例公告"
      >
        <div className="form-grid two-columns">
          <label className="field field-span">
            <span>{t("消息内容")}</span>
            <textarea
              name="banner_message_text"
              rows={4}
              maxLength={800}
              value={banner.message}
              disabled={bannerLocked}
              placeholder={t("留空表示不显示横幅")}
              onChange={(event) =>
                setBanner((current) => ({
                  ...current,
                  message: event.currentTarget.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>{t("消息类型")}</span>
            <UnifiedSelect
              ariaLabel={t("消息类型")}
              name="banner_message_type"
              value={banner.type}
              disabled={bannerLocked || !bannerEnabled}
              options={[
                { value: "success", label: t("成功") },
                { value: "info", label: t("信息") },
                { value: "warning", label: t("警告") },
                { value: "danger", label: t("错误") },
              ]}
              onChange={(value) =>
                setBanner((current) => ({
                  ...current,
                  type: value,
                }))
              }
            />
          </label>
          <div>
            <ToggleSetting
              name="banner_closable"
              title={t("允许用户关闭")}
              description={t("显示关闭按钮，用户可隐藏本次公告")}
              checked={banner.closable}
              disabled={bannerLocked || !bannerEnabled}
              onChange={(value) =>
                setBanner((current) => ({ ...current, closable: value }))
              }
            />
          </div>
          <label className="field">
            <span>{t("开始日期")}</span>
            <input
              name="banner_from_date"
              type="date"
              value={banner.fromDate}
              disabled={bannerLocked || !bannerEnabled}
              onChange={(event) =>
                setBanner((current) => ({
                  ...current,
                  fromDate: event.currentTarget.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>{t("结束日期")}</span>
            <input
              name="banner_to_date"
              type="date"
              value={banner.toDate}
              disabled={bannerLocked || !bannerEnabled}
              onChange={(event) =>
                setBanner((current) => ({
                  ...current,
                  toDate: event.currentTarget.value,
                }))
              }
            />
          </label>
        </div>
      </ConfigurationGroup>
    </form>
  );
}

function configurationTab(route: ConsoleRoute): ConfigurationTab {
  const tab = route.query.get("tab") as ConfigurationTab | null;
  return tab && ["auth", "security", "system"].includes(tab) ? tab : "auth";
}

export function AdministrationConfigurationSection({
  data,
  route,
  hasRootCertificate,
  navigate,
  onReload,
  onNotice,
}: {
  data: ConfigurationData;
  route: ConsoleRoute;
  hasRootCertificate: boolean;
  navigate: (path: string) => void;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const selected = configurationTab(route);
  const tabs: { key: ConfigurationTab; label: string }[] = [
    { key: "auth", label: "认证" },
    { key: "security", label: "安全" },
    { key: "system", label: "系统设置" },
  ];
  return (
    <section className="administration-config">
      <nav className="config-subtabs" aria-label={t("配置管理页面")}>
        {tabs.map((tab) => (
          <a
            key={tab.key}
            href={`#/administration/configuration?tab=${tab.key}`}
            className={selected === tab.key ? "active" : undefined}
            aria-current={selected === tab.key ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigate(`administration/configuration?tab=${tab.key}`);
            }}
          >
            {t(tab.label)}
          </a>
        ))}
      </nav>
      <ContentTransition mode={selected}>
        {selected === "auth" ? (
          <AuthenticationConfiguration
            configuration={data.configuration}
            onReload={onReload}
            onNotice={onNotice}
          />
        ) : selected === "security" ? (
          <SecurityConfiguration
            allowlist={data.allowlist}
            loadError={data.allowlistError}
            onReload={onReload}
            onNotice={onNotice}
          />
        ) : (
          <SystemConfiguration
            configuration={data.configuration}
            auditEvents={data.auditEvents}
            auditEventsError={data.auditEventsError}
            hasRootCertificate={hasRootCertificate}
            onReload={onReload}
            onNotice={onNotice}
          />
        )}
      </ContentTransition>
    </section>
  );
}
