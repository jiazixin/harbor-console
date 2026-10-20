import { type SubmitEvent, useState } from "react";

import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type { HarborConfiguration } from "../../app/models";
import { Icon } from "../../components/icons";
import { ToggleSetting } from "../../components/toggle-setting";
import { UnifiedSelect } from "../../components/unified-select";
import {
  addEditable,
  ConfigurationFormHeader,
  ConfigurationGroup,
  type ConfigurationPayload,
  ConfigurationSaveButton,
  ConfigurationScopeField,
  configurationBoolean,
  configurationEditable,
  configurationString,
  ConfigurationTextField,
  ConfigurationToggle,
  errorMessage,
  formString,
} from "./configuration-fields";

type AuthenticationMode =
  "db_auth" | "http_auth" | "ldap_auth" | "oidc_auth" | "uaa_auth";

const authenticationModes = new Set<AuthenticationMode>([
  "db_auth",
  "ldap_auth",
  "uaa_auth",
  "oidc_auth",
  "http_auth",
]);

/** Harbor configuration keys of each external provider and how to read them from the form. */
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

function authenticationMode(configuration: HarborConfiguration) {
  const value = configurationString(configuration, "auth_mode", "db_auth");
  return authenticationModes.has(value as AuthenticationMode)
    ? (value as AuthenticationMode)
    : "db_auth";
}

function authenticationToggles(configuration: HarborConfiguration) {
  const toggle = (key: string) => configurationBoolean(configuration, key);
  return {
    primary_auth_mode: toggle("primary_auth_mode"),
    self_registration: toggle("self_registration"),
    ldap_group_attach_parallel: toggle("ldap_group_attach_parallel"),
    ldap_verify_cert: toggle("ldap_verify_cert"),
    uaa_verify_cert: toggle("uaa_verify_cert"),
    http_authproxy_verify_cert: toggle("http_authproxy_verify_cert"),
    http_authproxy_skip_search: toggle("http_authproxy_skip_search"),
    oidc_verify_cert: toggle("oidc_verify_cert"),
    oidc_auto_onboard: toggle("oidc_auto_onboard"),
    oidc_logout: toggle("oidc_logout"),
  };
}

type AuthenticationToggles = ReturnType<typeof authenticationToggles>;

type ProviderSettingsProps = {
  configuration: HarborConfiguration;
  /** The mode Harbor currently uses; secrets may stay empty for it. */
  savedMode: AuthenticationMode;
  toggles: AuthenticationToggles;
  setToggle: (key: keyof AuthenticationToggles, value: boolean) => void;
};

function authenticationPayload(
  configuration: HarborConfiguration,
  mode: AuthenticationMode,
  data: FormData,
): ConfigurationPayload {
  const payload: ConfigurationPayload = {};
  addEditable(payload, configuration, "auth_mode", mode);
  addEditable(
    payload,
    configuration,
    "primary_auth_mode",
    mode !== "db_auth" && data.has("primary_auth_mode"),
  );
  if (mode === "db_auth") return payload;
  for (const [key, type] of Object.entries(authenticationFields[mode])) {
    const value =
      type === "boolean"
        ? data.has(key)
        : type === "number"
          ? Number(data.get(key))
          : formString(data, key);
    // An empty secret keeps the secret Harbor already stores.
    addEditable(payload, configuration, key, value, type === "secret");
  }
  return payload;
}

/** Tests the LDAP or OIDC settings in the form and returns the success message. */
async function testProviderConnection(
  mode: "ldap_auth" | "oidc_auth",
  data: FormData,
): Promise<string> {
  if (mode === "oidc_auth") {
    await controlApi.mutate("oidc-ping", {}, "POST", {
      url: formString(data, "oidc_endpoint"),
      verify_cert: data.has("oidc_verify_cert"),
    });
    return "OIDC 服务连接成功";
  }
  const searchPassword = data.get("ldap_search_password");
  const result = await controlApi.mutate<{
    data?: { message?: string; success?: boolean };
  }>("ldap-ping", {}, "POST", {
    ldap_url: formString(data, "ldap_url"),
    ldap_search_dn: formString(data, "ldap_search_dn"),
    ldap_search_password:
      typeof searchPassword === "string" ? searchPassword : "",
    ldap_base_dn: formString(data, "ldap_base_dn"),
    ldap_filter: formString(data, "ldap_filter"),
    ldap_uid: formString(data, "ldap_uid"),
    ldap_scope: Number(data.get("ldap_scope")),
    ldap_connection_timeout: Number(data.get("ldap_timeout")),
    ldap_verify_cert: data.has("ldap_verify_cert"),
  });
  if (result.data?.success === false) {
    throw new Error(result.data.message ?? "LDAP 服务测试失败");
  }
  return result.data?.message ?? "LDAP 服务连接成功";
}

function LdapSettings({
  configuration,
  toggles,
  setToggle,
}: ProviderSettingsProps) {
  return (
    <ConfigurationGroup title="LDAP 服务" description="用户和用户组目录连接">
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
            onChange={(value) => setToggle("ldap_group_attach_parallel", value)}
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
  );
}

function UaaSettings({
  configuration,
  savedMode,
  toggles,
  setToggle,
}: ProviderSettingsProps) {
  return (
    <ConfigurationGroup title="UAA 服务" description="Cloud Foundry UAA 认证">
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
          required={savedMode !== "uaa_auth"}
          placeholder={
            savedMode === "uaa_auth"
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
  );
}

function HttpAuthProxySettings({
  configuration,
  toggles,
  setToggle,
}: ProviderSettingsProps) {
  const { t } = useLocale();
  return (
    <ConfigurationGroup title="HTTP 认证代理" description="外部认证代理连接">
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
            onChange={(value) => setToggle("http_authproxy_verify_cert", value)}
          />
        </div>
        <div>
          <ConfigurationToggle
            configuration={configuration}
            configKey="http_authproxy_skip_search"
            title="跳过用户搜索"
            description="添加成员时不预先搜索外部用户"
            checked={toggles.http_authproxy_skip_search}
            onChange={(value) => setToggle("http_authproxy_skip_search", value)}
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
  );
}

function OidcSettings({
  configuration,
  savedMode,
  toggles,
  setToggle,
}: ProviderSettingsProps) {
  return (
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
          required={savedMode !== "oidc_auth"}
          placeholder={
            savedMode === "oidc_auth"
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
  );
}

const providerSettings = {
  ldap_auth: LdapSettings,
  uaa_auth: UaaSettings,
  http_auth: HttpAuthProxySettings,
  oidc_auth: OidcSettings,
} as const;

export function AuthenticationConfiguration({
  configuration,
  onReload,
  onNotice,
}: {
  configuration: HarborConfiguration;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const savedMode = authenticationMode(configuration);
  const [mode, setMode] = useState<AuthenticationMode>(savedMode);
  const [busy, setBusy] = useState<"save" | "test">();
  const [toggles, setToggles] = useState(() =>
    authenticationToggles(configuration),
  );
  const setToggle = (key: keyof AuthenticationToggles, value: boolean) =>
    setToggles((current) => ({ ...current, [key]: value }));
  const canTestConnection = mode === "ldap_auth" || mode === "oidc_auth";
  const ProviderSettings = mode === "db_auth" ? null : providerSettings[mode];

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const payload = authenticationPayload(
      configuration,
      mode,
      new FormData(event.currentTarget),
    );
    setBusy("save");
    try {
      await controlApi.mutate("configurations", {}, "PUT", payload);
      onNotice("认证配置已保存");
      onReload();
    } catch (error) {
      onNotice(errorMessage(error), true);
      setBusy(undefined);
    }
  }

  async function testConnection(form: HTMLFormElement) {
    if (mode !== "ldap_auth" && mode !== "oidc_auth") return;
    if (!form.reportValidity()) return;
    setBusy("test");
    try {
      onNotice(await testProviderConnection(mode, new FormData(form)));
    } catch (error) {
      onNotice(errorMessage(error), true);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <form
      className="settings-form configuration-form"
      onSubmit={(event) => void save(event)}
    >
      <ConfigurationFormHeader
        title="认证配置"
        description="Harbor 官方认证模式与身份提供方参数"
      >
        <div className="configuration-actions">
          {canTestConnection ? (
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
                <span className="spinner button-spinner" aria-hidden="true" />
              ) : (
                <Icon name="refresh" />
              )}
              <span>{t(busy === "test" ? "正在测试" : "测试连接")}</span>
            </button>
          ) : null}
          <ConfigurationSaveButton
            busy={busy === "save"}
            label="保存认证配置"
          />
        </div>
      </ConfigurationFormHeader>
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
                if (nextMode === "db_auth") {
                  setToggle("primary_auth_mode", false);
                }
              }}
            />
          </label>
          {ProviderSettings ? (
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
                description={t("Harbor v2.15 中为只读配置，仅显示当前状态")}
                checked={toggles.self_registration}
                disabled
                onChange={() => undefined}
              />
            </div>
          )}
        </div>
      </ConfigurationGroup>
      {ProviderSettings ? (
        <ProviderSettings
          configuration={configuration}
          savedMode={savedMode}
          toggles={toggles}
          setToggle={setToggle}
        />
      ) : null}
    </form>
  );
}
