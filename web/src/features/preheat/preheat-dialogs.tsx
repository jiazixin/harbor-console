import { type MouseEvent, useMemo, useState } from "react";

import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type {
  PreheatInstance,
  PreheatProviderMetadata,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import { UnifiedSelect } from "../../components/unified-select";

type AuthMode = "BASIC" | "NONE" | "OAUTH";

function normalizeAuthMode(value: string | undefined): AuthMode {
  const normalized = value?.toUpperCase();
  if (normalized === "BASIC" || normalized === "OAUTH") return normalized;
  return "NONE";
}

type PreheatInstanceDraft = {
  vendor: string;
  name: string;
  endpoint: string;
  description: string;
  authMode: AuthMode;
  username: string;
  password: string;
  token: string;
  enabled: boolean;
  insecure: boolean;
};

function instancePayload(
  draft: PreheatInstanceDraft,
  instance?: PreheatInstance,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...(instance?.id ? { id: instance.id } : {}),
    name: draft.name.trim(),
    description: draft.description.trim(),
    vendor: draft.vendor,
    endpoint: draft.endpoint.trim(),
    auth_mode: draft.authMode,
    enabled: draft.enabled,
    insecure: draft.insecure,
  };
  if (draft.authMode === "BASIC") {
    payload.auth_info =
      draft.username.trim() || draft.password
        ? { username: draft.username.trim(), password: draft.password }
        : {};
  } else if (draft.authMode === "OAUTH") {
    payload.auth_info = draft.token ? { token: draft.token } : {};
  }
  return payload;
}

export function PreheatInstanceDialog({
  providers,
  instance,
  onClose,
  onSaved,
  onNotice,
}: {
  providers: PreheatProviderMetadata[];
  instance?: PreheatInstance;
  onClose: () => void;
  onSaved: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const initialAuthMode = normalizeAuthMode(instance?.auth_mode);
  const [vendor, setVendor] = useState(
    instance?.vendor ?? providers.at(0)?.id ?? "",
  );
  const [name, setName] = useState(instance?.name ?? "");
  const [endpoint, setEndpoint] = useState(instance?.endpoint ?? "");
  const [description, setDescription] = useState(
    instance?.description ? t(instance.description) : "",
  );
  const [authMode, setAuthMode] = useState<AuthMode>(initialAuthMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(instance?.enabled !== false);
  const [insecure, setInsecure] = useState(Boolean(instance?.insecure));
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const draft = useMemo<PreheatInstanceDraft>(
    () => ({
      vendor,
      name,
      endpoint,
      description,
      authMode,
      username,
      password,
      token,
      enabled,
      insecure,
    }),
    [
      authMode,
      description,
      enabled,
      endpoint,
      insecure,
      name,
      password,
      token,
      username,
      vendor,
    ],
  );

  async function testDraft(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.closest("form");
    if (!form?.reportValidity() || testing) return;
    setTesting(true);
    setTestError("");
    try {
      await controlApi.mutate(
        "preheat-instance-ping",
        {},
        "POST",
        instancePayload(draft, instance),
      );
      onNotice("P2P Provider 连接正常");
    } catch (error) {
      setTestError(error instanceof Error ? error.message : String(error));
    } finally {
      setTesting(false);
    }
  }

  return (
    <ControlDialog
      title={instance ? "编辑 P2P 实例" : "新建 P2P 实例"}
      subtitle={instance?.name ?? "Harbor 分布式分发 Provider"}
      submitLabel={instance ? "保存实例" : "创建实例"}
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          instance ? "preheat-instance" : "preheat-instances",
          instance ? { name: instance.name } : {},
          instance ? "PUT" : "POST",
          instancePayload(draft, instance),
        );
        onSaved();
      }}
    >
      {testError ? (
        <div className="notice notice-danger" role="alert">
          {testError}
        </div>
      ) : null}
      <div className="form-grid two-columns">
        <label className="field">
          <span>Provider</span>
          <UnifiedSelect
            name="vendor"
            ariaLabel="Provider"
            value={vendor}
            options={providers.map((provider) => ({
              value: provider.id,
              label: provider.name?.trim() ? provider.name.trim() : provider.id,
            }))}
            onChange={setVendor}
          />
        </label>
        <label className="field">
          <span>{t("实例名称")}</span>
          <input
            name="name"
            required
            maxLength={255}
            pattern="[A-Za-z0-9]+([._\-][A-Za-z0-9]+)*"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label className="field field-span">
          <span>{t("服务地址")}</span>
          <input
            name="endpoint"
            type="url"
            required
            value={endpoint}
            placeholder="https://dragonfly.example.com"
            onChange={(event) => setEndpoint(event.currentTarget.value)}
          />
        </label>
        <label className="field field-span">
          <span>{t("描述")}</span>
          <textarea
            name="description"
            rows={3}
            maxLength={1024}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span>{t("认证模式")}</span>
          <UnifiedSelect
            name="auth_mode"
            ariaLabel={t("认证模式")}
            value={authMode}
            options={[
              { value: "NONE", label: t("无认证") },
              { value: "BASIC", label: t("用户名密码") },
              { value: "OAUTH", label: "OAuth Token" },
            ]}
            onChange={(value) => setAuthMode(normalizeAuthMode(value))}
          />
        </label>
        <span />
        {authMode === "BASIC" ? (
          <>
            <label className="field preheat-auth-field">
              <span>{t("用户名")}</span>
              <input
                name="auth_username"
                required={!instance}
                autoComplete="username"
                placeholder={instance ? t("留空保持原凭据") : t("用户名")}
                value={username}
                onChange={(event) => setUsername(event.currentTarget.value)}
              />
            </label>
            <label className="field preheat-auth-field">
              <span>{t("密码")}</span>
              <input
                name="auth_password"
                type="password"
                required={!instance}
                autoComplete="new-password"
                placeholder={instance ? t("留空保持原凭据") : t("密码")}
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
              />
            </label>
          </>
        ) : null}
        {authMode === "OAUTH" ? (
          <label className="field field-span preheat-auth-field">
            <span>OAuth Token</span>
            <input
              name="auth_token"
              type="password"
              required={!instance}
              autoComplete="new-password"
              placeholder={instance ? t("留空保持原 Token") : t("访问 Token")}
              value={token}
              onChange={(event) => setToken(event.currentTarget.value)}
            />
          </label>
        ) : null}
      </div>
      <div className="check-grid preheat-instance-flags">
        <label className="check-row">
          <input
            name="enabled"
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.currentTarget.checked)}
          />
          <span>
            <strong>{t("启用实例")}</strong>
            <small>{t("允许项目预热策略使用该实例")}</small>
          </span>
        </label>
        <label className="check-row">
          <input
            name="insecure"
            type="checkbox"
            checked={insecure}
            onChange={(event) => setInsecure(event.currentTarget.checked)}
          />
          <span>
            <strong>{t("跳过 TLS 验证")}</strong>
            <small>{t("仅用于可信内网或自签名证书")}</small>
          </span>
        </label>
      </div>
      <div className="registry-dialog-actions">
        <span>{t("保存前可使用当前表单配置检查 Provider 健康状态。")}</span>
        <button
          className="button button-small"
          type="button"
          disabled={testing}
          onClick={(event) => void testDraft(event)}
        >
          {testing ? (
            <span className="spinner button-spinner" />
          ) : (
            <Icon name="refresh" />
          )}
          <span>{t(testing ? "正在测试" : "测试连接")}</span>
        </button>
      </div>
    </ControlDialog>
  );
}

export function DeletePreheatInstanceDialog({
  instance,
  onClose,
  onDeleted,
}: {
  instance: PreheatInstance;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale } = useLocale();
  return (
    <ControlDialog
      title="删除 P2P 实例"
      subtitle={instance.name}
      submitLabel="删除实例"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "preheat-instance",
          { name: instance.name },
          "DELETE",
        );
        onDeleted();
      }}
    >
      <div className="notice notice-danger">
        <Icon name="alert" />
        <span>
          {locale === "en-US"
            ? `Instance ${instance.name} will be deleted. Preheat policies using it must be updated first.`
            : `实例 ${instance.name} 将被删除，引用它的预热策略必须先调整。`}
        </span>
      </div>
    </ControlDialog>
  );
}
