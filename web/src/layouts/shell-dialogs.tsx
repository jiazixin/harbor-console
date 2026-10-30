import { useState } from "react";
import { instanceApi } from "../app/api-client";
import { errorText, UserInputError } from "../app/errors";
import { useLocale } from "../app/locale-context";
import type { HarborIdentity, HarborInstance, Session } from "../app/models";
import {
  type ConsolePreferences,
  loadPreferences,
  savePreferences,
} from "../app/preferences";
import { useControlMutation } from "../app/use-control-mutation";
import { ControlDialog } from "../components/control-dialog";
import { FormInput } from "../components/form-input";
import { FormTextarea } from "../components/form-textarea";
import { Icon } from "../components/icon";
import uiStyles0 from "../components/shared-ui.module.css";
import { UnifiedSelect } from "../components/unified-select";
import { createClassNames } from "../lib/css/class-names";
import { instanceHost } from "../lib/format/formatters";
import uiStyles1 from "./shell-dialogs.module.css";

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
    throw new UserInputError("用户备注不得超过 30 个 UTF-8 字节");
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

type PreferenceChoiceProps = {
  name: string;
  value: string;
  title: string;
  description: string;
  checked: boolean;
};

function PreferenceChoice({
  name,
  value,
  title,
  description,
  checked,
}: PreferenceChoiceProps) {
  return (
    <label className={resolveClasses("check-row")}>
      <FormInput
        name={name}
        type="radio"
        value={value}
        defaultChecked={checked}
      />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

type AddInstanceDialogProps = {
  demo: boolean;
  onClose: () => void;
  onSessionChanged: (session: Session, message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
};

function AddInstanceDialog({
  demo,
  onClose,
  onSessionChanged,
  onNotice,
}: AddInstanceDialogProps) {
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
      <div className={resolveClasses("form-grid")}>
        <label className={resolveClasses("field")}>
          <span>{t("Harbor 地址")}</span>
          <div className={resolveClasses("url-input-group")}>
            <UnifiedSelect
              ariaLabel={t("连接协议")}
              value={protocol}
              options={[
                { value: "https", label: "https://" },
                { value: "http", label: "http://" },
              ]}
              onChange={setProtocol}
            />
            <FormInput
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
        <label className={resolveClasses("field")}>
          <span>{t("用户名")}</span>
          <FormInput
            name="username"
            required
            maxLength={256}
            placeholder="admin"
            autoComplete="username"
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("密码")}</span>
          <FormInput
            name="password"
            type="password"
            required
            maxLength={4096}
            autoComplete="current-password"
          />
        </label>
        <label className={resolveClasses("check-row")}>
          <FormInput name="skip_tls_verify" type="checkbox" />
          <span>
            <strong>{t("允许自签名证书")}</strong>
            <small>{t("仅在可信内网环境中启用")}</small>
          </span>
        </label>
        {demo ? (
          <div className={resolveClasses("dialog-secondary-action")}>
            <span>{t("需要验证多实例流程？")}</span>
            <button
              className={resolveClasses("button button-small")}
              type="button"
              disabled={addingDemo}
              onClick={() => {
                setAddingDemo(true);
                void instanceApi
                  .addDemo()
                  .then((current) => {
                    onSessionChanged(current, t("演示实例已添加"));
                  })
                  .catch((error: unknown) => {
                    onNotice(errorText(error), true);
                    setAddingDemo(false);
                  });
              }}
            >
              {addingDemo ? (
                <span className={resolveClasses("spinner button-spinner")} />
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

type RemoveInstanceDialogProps = {
  instance: HarborInstance;
  onClose: () => void;
  onSessionChanged: (session: Session, message: string) => void;
};

function RemoveInstanceDialog({
  instance,
  onClose,
  onSessionChanged,
}: RemoveInstanceDialogProps) {
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
      <div className={resolveClasses("notice notice-danger")}>
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

type ProfileDialogProps = {
  session: Session;
  identity?: HarborIdentity;
  onClose: () => void;
  onIdentityChanged: (identity: HarborIdentity, message: string) => void;
};

function ProfileDialog({
  session,
  identity,
  onClose,
  onIdentityChanged,
}: ProfileDialogProps) {
  const mutate = useControlMutation([]);
  const { t } = useLocale();
  return (
    <ControlDialog
      title="编辑个人资料"
      subtitle={identity?.username ?? session.username}
      submitLabel="保存资料"
      onClose={onClose}
      onSubmit={async (data) => {
        if (!identity?.user_id)
          throw new UserInputError(t("当前用户资料不可编辑"));
        const next = {
          realname: formString(data, "realname"),
          email: formString(data, "email"),
          comment: profileComment(formString(data, "comment")),
        };
        await mutate({
          operation: "user",
          parameters: { id: identity.user_id },
          method: "PUT",
          payload: next,
        });
        onIdentityChanged({ ...identity, ...next }, t("个人资料已更新"));
      }}
    >
      <div className={resolveClasses("form-grid two-columns")}>
        <label className={resolveClasses("field")}>
          <span>{t("姓名")}</span>
          <FormInput
            name="realname"
            maxLength={255}
            defaultValue={identity?.realname ?? ""}
            autoComplete="name"
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("邮箱")}</span>
          <FormInput
            name="email"
            type="email"
            maxLength={255}
            defaultValue={identity?.email ?? ""}
            autoComplete="email"
          />
        </label>
        <label className={resolveClasses("field field-span")}>
          <span>{t("备注")}</span>
          <FormTextarea
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

type PasswordDialogProps = {
  identity?: HarborIdentity;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

function PasswordDialog({ identity, onClose, onNotice }: PasswordDialogProps) {
  const mutate = useControlMutation([]);
  const { t } = useLocale();
  return (
    <ControlDialog
      title="修改密码"
      subtitle="成功后控制台会自动续用新凭据"
      submitLabel="更新密码"
      onClose={onClose}
      onSubmit={async (data) => {
        if (!identity?.user_id)
          throw new UserInputError(t("当前用户密码不可修改"));
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
          throw new UserInputError(t("两次输入的新密码不一致"));
        if (!secretPattern(password))
          throw new UserInputError(t("密码复杂度不符合要求"));
        await mutate({
          operation: "current-user-password",
          parameters: { id: identity.user_id },
          method: "PUT",
          payload: {
            old_password: oldPassword,
            new_password: password,
          },
        });
        onClose();
        onNotice(t("密码已更新，当前连接已续用新凭据"));
      }}
    >
      <div className={resolveClasses("form-grid")}>
        <label className={resolveClasses("field")}>
          <span>{t("当前密码")}</span>
          <FormInput
            name="old_password"
            type="password"
            required
            maxLength={4096}
            autoComplete="current-password"
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("新密码")}</span>
          <FormInput
            name="new_password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
          <small className={resolveClasses("field-help")}>
            {t("8-128 个字符，至少包含大写字母、小写字母和数字。")}
          </small>
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("再次输入新密码")}</span>
          <FormInput
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

type CliSecretDialogProps = {
  identity?: HarborIdentity;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

function CliSecretDialog({
  identity,
  onClose,
  onNotice,
}: CliSecretDialogProps) {
  const mutate = useControlMutation([]);
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
          throw new UserInputError(t("当前账号没有可管理的 OIDC CLI Secret"));
        const secret = formString(data, "secret");
        const confirmation = formString(data, "confirmation");
        if (secret !== confirmation)
          throw new UserInputError(t("两次输入的 CLI Secret 不一致"));
        if (!secretPattern(secret))
          throw new UserInputError(t("密码复杂度不符合要求"));
        await mutate({
          operation: "current-user-cli-secret",
          parameters: { id: identity.user_id },
          method: "PUT",
          payload: { secret },
        });
        onClose();
        onNotice(t("CLI Secret 已更新，当前连接已续用新凭据"));
      }}
    >
      <div className={resolveClasses("form-grid")}>
        <label className={resolveClasses("field")}>
          <span>{t("新 CLI Secret")}</span>
          <FormInput
            name="secret"
            type="password"
            required
            minLength={8}
            maxLength={128}
            defaultValue={suggestedSecret}
            autoComplete="new-password"
          />
          <small className={resolveClasses("field-help")}>
            {t(
              "可使用预生成值，或输入至少包含大写字母、小写字母和数字的自定义值。",
            )}
          </small>
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("再次输入")}</span>
          <FormInput
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
      <div className={resolveClasses("notice notice-warning")}>
        <Icon name="alert" />
        <span>
          {t("Docker、Helm 和自动化任务需要同步更新为新的 CLI Secret。")}
        </span>
      </div>
    </ControlDialog>
  );
}

type PreferencesDialogProps = {
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

function PreferencesDialog({ onClose, onNotice }: PreferencesDialogProps) {
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
      <div className={resolveClasses("preference-sections")}>
        <fieldset className={resolveClasses("preference-section")}>
          <legend>{t("日期与时间")}</legend>
          <p>{t("影响列表、详情和审计日志中的时间显示。")}</p>
          <div className={resolveClasses("preference-choice-grid")}>
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
        <fieldset className={resolveClasses("preference-section")}>
          <legend>{t("容器 CLI")}</legend>
          <p>{t("用于生成拉取、Tag 和推送命令。")}</p>
          <div className={resolveClasses("preference-choice-grid three")}>
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
        <fieldset className={resolveClasses("preference-section")}>
          <legend>{t("仓库展示")}</legend>
          <p>{t("作为镜像仓库和项目仓库的默认展示方式。")}</p>
          <div className={resolveClasses("preference-choice-grid")}>
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

type ShellDialogHostProps = {
  dialog?: ShellDialog;
  session: Session;
  identity?: HarborIdentity;
  onClose: () => void;
  onIdentityChanged: (identity: HarborIdentity, message: string) => void;
  onSessionChanged: (session: Session, message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function ShellDialogHost({
  dialog,
  session,
  identity,
  onClose,
  onIdentityChanged,
  onSessionChanged,
  onNotice,
}: ShellDialogHostProps) {
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

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  "unified-select": uiStyles0.unifiedSelect,
  "check-row": uiStyles0.checkRow,
  "form-grid": uiStyles0.formGrid,
  field: uiStyles0.field,
  "url-input-group": uiStyles0.urlInputGroup,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  spinner: uiStyles0.spinner,
  "button-spinner": uiStyles0.buttonSpinner,
  notice: uiStyles0.notice,
  "notice-danger": uiStyles0.noticeDanger,
  "two-columns": uiStyles0.twoColumns,
  "field-span": uiStyles0.fieldSpan,
  "field-help": uiStyles0.fieldHelp,
  "notice-warning": uiStyles0.noticeWarning,
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
  "dialog-secondary-action": uiStyles1.dialogSecondaryAction,
  "preference-sections": uiStyles1.preferenceSections,
  "preference-section": uiStyles1.preferenceSection,
  "preference-choice-grid": uiStyles1.preferenceChoiceGrid,
  three: uiStyles1.three,
});
