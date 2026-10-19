import { useState } from "react";

import { controlApi, instanceApi } from "../app/api-client";
import { instanceHost } from "../app/formatters";
import { useLocale } from "../app/locale-context";
import type { HarborIdentity, HarborInstance, Session } from "../app/models";
import {
  type ConsolePreferences,
  loadPreferences,
  savePreferences,
} from "../app/preferences";
import { ControlDialog } from "../components/control-dialog";
import { Icon } from "../components/icons";
import { UnifiedSelect } from "../components/unified-select";

/** Account, instance and preference dialogs opened from the top bar. */
export type ShellDialog =
  | { kind: "add-instance" }
  | { kind: "cli-secret" }
  | { kind: "password" }
  | { kind: "preferences" }
  | { kind: "profile" }
  | { kind: "remove-instance"; instance: HarborInstance };

function formString(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function profileComment(value: string) {
  if (new TextEncoder().encode(value).length > 30)
    throw new Error("用户备注不得超过 30 个 UTF-8 字节");
  return value;
}

function secretPattern(value: string): boolean {
  return /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
}

function generatedCLISecret(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = new Uint32Array(24);
  crypto.getRandomValues(values);
  return `Hc1${Array.from(values, (value) => alphabet[value % alphabet.length]).join("")}`;
}

function PreferenceChoice({
  name,
  value,
  title,
  description,
  checked,
}: {
  name: string;
  value: string;
  title: string;
  description: string;
  checked: boolean;
}) {
  return (
    <label className="check-row">
      <input name={name} type="radio" value={value} defaultChecked={checked} />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

function AddInstanceDialog({
  demo,
  onClose,
  onSessionChanged,
  onNotice,
}: {
  demo: boolean;
  onClose: () => void;
  onSessionChanged: (session: Session, message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const [protocol, setProtocol] = useState<"http" | "https">("https");
  const [addingDemo, setAddingDemo] = useState(false);
  return (
    <ControlDialog
      title="新增 Harbor 实例"
      subtitle="连接成功后将自动切换到新实例"
      submitLabel="验证并连接"
      submitIcon="arrow-right"
      onClose={onClose}
      onSubmit={async (data) => {
        const address = formString(data, "address");
        const current = await instanceApi.add({
          url: `${protocol}://${address}`,
          username: formString(data, "username"),
          password:
            typeof data.get("password") === "string"
              ? (data.get("password") as string)
              : "",
          skip_tls_verify: data.has("skip_tls_verify"),
        });
        onSessionChanged(current, t("新实例已连接"));
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>{t("Harbor 地址")}</span>
          <div className="url-input-group">
            <UnifiedSelect
              ariaLabel={t("连接协议")}
              value={protocol}
              options={[
                { value: "https", label: "https://" },
                { value: "http", label: "http://" },
              ]}
              onChange={setProtocol}
            />
            <input
              name="address"
              type="text"
              aria-label={t("Harbor 地址")}
              inputMode="url"
              required
              maxLength={2048}
              placeholder="harbor.example.com"
              autoComplete="url"
            />
          </div>
        </label>
        <label className="field">
          <span>{t("用户名")}</span>
          <input
            name="username"
            required
            maxLength={256}
            placeholder="admin"
            autoComplete="username"
          />
        </label>
        <label className="field">
          <span>{t("密码")}</span>
          <input
            name="password"
            type="password"
            required
            maxLength={4096}
            autoComplete="current-password"
          />
        </label>
        <label className="check-row">
          <input name="skip_tls_verify" type="checkbox" />
          <span>
            <strong>{t("允许自签名证书")}</strong>
            <small>{t("仅在可信内网环境中启用")}</small>
          </span>
        </label>
        {demo ? (
          <div className="dialog-secondary-action">
            <span>{t("需要验证多实例流程？")}</span>
            <button
              className="button button-small"
              type="button"
              disabled={addingDemo}
              onClick={() => {
                setAddingDemo(true);
                void instanceApi
                  .addDemo()
                  .then((current) =>
                    onSessionChanged(current, t("演示实例已添加")),
                  )
                  .catch((error: unknown) => {
                    onNotice(
                      error instanceof Error ? error.message : String(error),
                      true,
                    );
                    setAddingDemo(false);
                  });
              }}
            >
              {addingDemo ? (
                <span className="spinner button-spinner" />
              ) : (
                <Icon name="plus" />
              )}
              <span>{t("新增演示实例")}</span>
            </button>
          </div>
        ) : null}
      </div>
    </ControlDialog>
  );
}

function RemoveInstanceDialog({
  instance,
  onClose,
  onSessionChanged,
}: {
  instance: HarborInstance;
  onClose: () => void;
  onSessionChanged: (session: Session, message: string) => void;
}) {
  const { t } = useLocale();
  const host = instanceHost(instance.instance_url);
  return (
    <ControlDialog
      title="移除 Harbor 实例"
      subtitle={host}
      submitLabel="移除连接"
      submitIcon="x"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        const current = await instanceApi.remove(instance.connection_id);
        onSessionChanged(current, t("实例连接已移除"));
      }}
    >
      <div className="notice notice-danger">
        <Icon name="alert" />
        <span>
          {t(
            "只会清除控制台中的临时连接与凭据，不会修改 Harbor 中的任何资源。",
          )}
        </span>
      </div>
    </ControlDialog>
  );
}

function ProfileDialog({
  session,
  identity,
  onClose,
  onIdentityChanged,
}: {
  session: Session;
  identity?: HarborIdentity;
  onClose: () => void;
  onIdentityChanged: (identity: HarborIdentity, message: string) => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="编辑个人资料"
      subtitle={identity?.username ?? session.username}
      submitLabel="保存资料"
      onClose={onClose}
      onSubmit={async (data) => {
        if (!identity?.user_id) throw new Error(t("当前用户资料不可编辑"));
        const next = {
          realname: formString(data, "realname"),
          email: formString(data, "email"),
          comment: profileComment(formString(data, "comment")),
        };
        await controlApi.mutate("user", { id: identity.user_id }, "PUT", next);
        onIdentityChanged({ ...identity, ...next }, t("个人资料已更新"));
      }}
    >
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("姓名")}</span>
          <input
            name="realname"
            maxLength={255}
            defaultValue={identity?.realname ?? ""}
            autoComplete="name"
          />
        </label>
        <label className="field">
          <span>{t("邮箱")}</span>
          <input
            name="email"
            type="email"
            maxLength={255}
            defaultValue={identity?.email ?? ""}
            autoComplete="email"
          />
        </label>
        <label className="field field-span">
          <span>{t("备注")}</span>
          <textarea
            name="comment"
            rows={3}
            maxLength={30}
            defaultValue={identity?.comment ?? ""}
          />
        </label>
      </div>
    </ControlDialog>
  );
}

function PasswordDialog({
  identity,
  onClose,
  onNotice,
}: {
  identity?: HarborIdentity;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="修改密码"
      subtitle="成功后控制台会自动续用新凭据"
      submitLabel="更新密码"
      onClose={onClose}
      onSubmit={async (data) => {
        if (!identity?.user_id) throw new Error(t("当前用户密码不可修改"));
        const oldPassword =
          typeof data.get("old_password") === "string"
            ? (data.get("old_password") as string)
            : "";
        const password =
          typeof data.get("new_password") === "string"
            ? (data.get("new_password") as string)
            : "";
        const confirmation =
          typeof data.get("confirmation") === "string"
            ? (data.get("confirmation") as string)
            : "";
        if (password !== confirmation)
          throw new Error(t("两次输入的新密码不一致"));
        if (!secretPattern(password))
          throw new Error(t("密码复杂度不符合要求"));
        await controlApi.mutate(
          "current-user-password",
          { id: identity.user_id },
          "PUT",
          { old_password: oldPassword, new_password: password },
        );
        onClose();
        onNotice(t("密码已更新，当前连接已续用新凭据"));
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>{t("当前密码")}</span>
          <input
            name="old_password"
            type="password"
            required
            maxLength={4096}
            autoComplete="current-password"
          />
        </label>
        <label className="field">
          <span>{t("新密码")}</span>
          <input
            name="new_password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
          <small className="field-help">
            {t("8-128 个字符，至少包含大写字母、小写字母和数字。")}
          </small>
        </label>
        <label className="field">
          <span>{t("再次输入新密码")}</span>
          <input
            name="confirmation"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
        </label>
      </div>
    </ControlDialog>
  );
}

function CliSecretDialog({
  identity,
  onClose,
  onNotice,
}: {
  identity?: HarborIdentity;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const [suggestedSecret] = useState(generatedCLISecret);
  return (
    <ControlDialog
      title="更新 CLI Secret"
      subtitle="更新后旧 Secret 立即失效，当前连接会自动续用新值"
      submitLabel="更新 Secret"
      onClose={onClose}
      onSubmit={async (data) => {
        if (!identity?.user_id)
          throw new Error(t("当前账号没有可管理的 OIDC CLI Secret"));
        const secret = formString(data, "secret");
        const confirmation = formString(data, "confirmation");
        if (secret !== confirmation)
          throw new Error(t("两次输入的 CLI Secret 不一致"));
        if (!secretPattern(secret)) throw new Error(t("密码复杂度不符合要求"));
        await controlApi.mutate(
          "current-user-cli-secret",
          { id: identity.user_id },
          "PUT",
          { secret },
        );
        onClose();
        onNotice(t("CLI Secret 已更新，当前连接已续用新凭据"));
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>{t("新 CLI Secret")}</span>
          <input
            name="secret"
            type="password"
            required
            minLength={8}
            maxLength={128}
            defaultValue={suggestedSecret}
            autoComplete="new-password"
          />
          <small className="field-help">
            {t(
              "可使用预生成值，或输入至少包含大写字母、小写字母和数字的自定义值。",
            )}
          </small>
        </label>
        <label className="field">
          <span>{t("再次输入")}</span>
          <input
            name="confirmation"
            type="password"
            required
            minLength={8}
            maxLength={128}
            defaultValue={suggestedSecret}
            autoComplete="new-password"
          />
        </label>
      </div>
      <div className="notice notice-warning">
        <Icon name="alert" />
        <span>
          {t("Docker、Helm 和自动化任务需要同步更新为新的 CLI Secret。")}
        </span>
      </div>
    </ControlDialog>
  );
}

function PreferencesDialog({
  onClose,
  onNotice,
}: {
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const [preferences] = useState(loadPreferences);
  return (
    <ControlDialog
      title="显示与命令偏好"
      subtitle="仅保存在当前浏览器，不会写入 Harbor"
      submitLabel="保存偏好"
      onClose={onClose}
      onSubmit={(data) => {
        const next: ConsolePreferences = {
          dateTimezone:
            formString(data, "date_timezone") === "utc" ? "utc" : "local",
          runtime: (["docker", "nerdctl", "podman"].includes(
            formString(data, "runtime"),
          )
            ? formString(data, "runtime")
            : "docker") as ConsolePreferences["runtime"],
          repositoryView:
            formString(data, "repository_view") === "card" ? "card" : "list",
          registryView: preferences.registryView,
        };
        savePreferences(next);
        onClose();
        onNotice(t("偏好已保存"));
      }}
    >
      <div className="preference-sections">
        <fieldset className="preference-section">
          <legend>{t("日期与时间")}</legend>
          <p>{t("影响列表、详情和审计日志中的时间显示。")}</p>
          <div className="preference-choice-grid">
            <PreferenceChoice
              name="date_timezone"
              value="local"
              title={t("浏览器当前时区")}
              description={
                Intl.DateTimeFormat().resolvedOptions().timeZone || "Local"
              }
              checked={preferences.dateTimezone === "local"}
            />
            <PreferenceChoice
              name="date_timezone"
              value="utc"
              title="UTC"
              description={t("按协调世界时显示")}
              checked={preferences.dateTimezone === "utc"}
            />
          </div>
        </fieldset>
        <fieldset className="preference-section">
          <legend>{t("容器 CLI")}</legend>
          <p>{t("用于生成拉取、Tag 和推送命令。")}</p>
          <div className="preference-choice-grid three">
            <PreferenceChoice
              name="runtime"
              value="docker"
              title="Docker"
              description="docker"
              checked={preferences.runtime === "docker"}
            />
            <PreferenceChoice
              name="runtime"
              value="podman"
              title="Podman"
              description="podman"
              checked={preferences.runtime === "podman"}
            />
            <PreferenceChoice
              name="runtime"
              value="nerdctl"
              title="nerdctl"
              description="containerd"
              checked={preferences.runtime === "nerdctl"}
            />
          </div>
        </fieldset>
        <fieldset className="preference-section">
          <legend>{t("仓库展示")}</legend>
          <p>{t("作为镜像仓库和项目仓库的默认展示方式。")}</p>
          <div className="preference-choice-grid">
            <PreferenceChoice
              name="repository_view"
              value="list"
              title={t("列表")}
              description={t("适合密集比较")}
              checked={preferences.repositoryView === "list"}
            />
            <PreferenceChoice
              name="repository_view"
              value="card"
              title={t("卡片")}
              description={t("适合浏览仓库")}
              checked={preferences.repositoryView === "card"}
            />
          </div>
        </fieldset>
      </div>
    </ControlDialog>
  );
}

export function ShellDialogHost({
  dialog,
  session,
  identity,
  onClose,
  onIdentityChanged,
  onSessionChanged,
  onNotice,
}: {
  dialog?: ShellDialog;
  session: Session;
  identity?: HarborIdentity;
  onClose: () => void;
  onIdentityChanged: (identity: HarborIdentity, message: string) => void;
  onSessionChanged: (session: Session, message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  switch (dialog?.kind) {
    case undefined:
      return null;
    case "add-instance":
      return (
        <AddInstanceDialog
          demo={session.demo}
          onClose={onClose}
          onSessionChanged={onSessionChanged}
          onNotice={onNotice}
        />
      );
    case "remove-instance":
      return (
        <RemoveInstanceDialog
          instance={dialog.instance}
          onClose={onClose}
          onSessionChanged={onSessionChanged}
        />
      );
    case "profile":
      return (
        <ProfileDialog
          session={session}
          identity={identity}
          onClose={onClose}
          onIdentityChanged={onIdentityChanged}
        />
      );
    case "password":
      return (
        <PasswordDialog
          identity={identity}
          onClose={onClose}
          onNotice={onNotice}
        />
      );
    case "cli-secret":
      return (
        <CliSecretDialog
          identity={identity}
          onClose={onClose}
          onNotice={onNotice}
        />
      );
    case "preferences":
      return <PreferencesDialog onClose={onClose} onNotice={onNotice} />;
  }
}
