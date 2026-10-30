import { type MouseEvent, useState } from "react";
import { errorText } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type {
  PreheatInstance,
  PreheatProviderMetadata,
} from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { FormTextarea } from "../../components/form-textarea";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./preheat-dialogs-support";

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

type PreheatInstanceDialogProps = {
  providers: PreheatProviderMetadata[];
  instance?: PreheatInstance;
  onClose: () => void;
  onSaved: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function PreheatInstanceDialog({
  providers,
  instance,
  onClose,
  onSaved,
  onNotice,
}: PreheatInstanceDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
  const draft = ((): PreheatInstanceDraft =>
    (() => ({
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
    }))())();

  async function testDraft(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.closest("form");
    if (!form?.reportValidity() || testing) return;
    setTesting(true);
    setTestError("");
    try {
      await mutate({
        operation: "preheat-instance-ping",
        parameters: {},
        method: "POST",
        payload: instancePayload(draft, instance),
      });
      onNotice("P2P Provider 连接正常");
    } catch (error) {
      setTestError(errorText(error));
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
        await mutate({
          operation: instance ? "preheat-instance" : "preheat-instances",
          parameters: instance ? { name: instance.name } : {},
          method: instance ? "PUT" : "POST",
          payload: instancePayload(draft, instance),
        });
        onSaved();
      }}
    >
      {testError ? (
        <div className={resolveClasses("notice notice-danger")} role="alert">
          {testError}
        </div>
      ) : null}
      <div className={resolveClasses("form-grid two-columns")}>
        <label className={resolveClasses("field")}>
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
        <label className={resolveClasses("field")}>
          <span>{t("实例名称")}</span>
          <FormInput
            name="name"
            required
            maxLength={255}
            pattern="[A-Za-z0-9]+([._\-][A-Za-z0-9]+)*"
            autoComplete="off"
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field field-span")}>
          <span>{t("服务地址")}</span>
          <FormInput
            name="endpoint"
            type="url"
            required
            value={endpoint}
            placeholder="https://dragonfly.example.com"
            onChange={(event) => {
              setEndpoint(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field field-span")}>
          <span>{t("描述")}</span>
          <FormTextarea
            name="description"
            rows={3}
            maxLength={1024}
            value={description}
            onChange={(event) => {
              setDescription(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field")}>
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
            onChange={(value) => {
              setAuthMode(normalizeAuthMode(value));
            }}
          />
        </label>
        <span />
        {authMode === "BASIC" ? (
          <>
            <label className={resolveClasses("field preheat-auth-field")}>
              <span>{t("用户名")}</span>
              <FormInput
                name="auth_username"
                required={!instance}
                autoComplete="username"
                placeholder={instance ? t("留空保持原凭据") : t("用户名")}
                value={username}
                onChange={(event) => {
                  setUsername(event.currentTarget.value);
                }}
              />
            </label>
            <label className={resolveClasses("field preheat-auth-field")}>
              <span>{t("密码")}</span>
              <FormInput
                name="auth_password"
                type="password"
                required={!instance}
                autoComplete="new-password"
                placeholder={instance ? t("留空保持原凭据") : t("密码")}
                value={password}
                onChange={(event) => {
                  setPassword(event.currentTarget.value);
                }}
              />
            </label>
          </>
        ) : null}
        {authMode === "OAUTH" ? (
          <label
            className={resolveClasses("field field-span preheat-auth-field")}
          >
            <span>OAuth Token</span>
            <FormInput
              name="auth_token"
              type="password"
              required={!instance}
              autoComplete="new-password"
              placeholder={instance ? t("留空保持原 Token") : t("访问 Token")}
              value={token}
              onChange={(event) => {
                setToken(event.currentTarget.value);
              }}
            />
          </label>
        ) : null}
      </div>
      <div className={resolveClasses("check-grid preheat-instance-flags")}>
        <label className={resolveClasses("check-row")}>
          <FormInput
            name="enabled"
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.currentTarget.checked);
            }}
          />
          <span>
            <strong>{t("启用实例")}</strong>
            <small>{t("允许项目预热策略使用该实例")}</small>
          </span>
        </label>
        <label className={resolveClasses("check-row")}>
          <FormInput
            name="insecure"
            type="checkbox"
            checked={insecure}
            onChange={(event) => {
              setInsecure(event.currentTarget.checked);
            }}
          />
          <span>
            <strong>{t("跳过 TLS 验证")}</strong>
            <small>{t("仅用于可信内网或自签名证书")}</small>
          </span>
        </label>
      </div>
      <div className={resolveClasses("registry-dialog-actions")}>
        <span>{t("保存前可使用当前表单配置检查 Provider 健康状态。")}</span>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          disabled={testing}
          onClick={(event) => void testDraft(event)}
        >
          {testing ? (
            <span className={resolveClasses("spinner button-spinner")} />
          ) : (
            <Icon name="refresh" />
          )}
          <span>{t(testing ? "正在测试" : "测试连接")}</span>
        </button>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  "unified-select": uiStyles0.unifiedSelect,
  notice: uiStyles0.notice,
  "notice-danger": uiStyles0.noticeDanger,
  "form-grid": uiStyles0.formGrid,
  "two-columns": uiStyles0.twoColumns,
  field: uiStyles0.field,
  "field-span": uiStyles0.fieldSpan,
  "check-grid": uiStyles0.checkGrid,
  "check-row": uiStyles0.checkRow,
  "registry-dialog-actions": uiStyles0.registryDialogActions,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  spinner: uiStyles0.spinner,
  "button-spinner": uiStyles0.buttonSpinner,
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
