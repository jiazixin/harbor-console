import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

import { controlApi, instanceApi, searchApi } from "../app/api-client";
import { formatNumber, instanceHost } from "../app/formatters";
import { useLocale } from "../app/locale-context";
import type {
  Dashboard,
  HarborIdentity,
  HarborInstance,
  SearchResults,
  Session,
} from "../app/models";
import {
  loadPreferences,
  savePreferences,
  type ConsolePreferences,
} from "../app/preferences";
import { ControlDialog } from "../components/control-dialog";
import { Icon } from "../components/icons";
import { UnifiedSelect } from "../components/unified-select";
import { useModal } from "../components/use-modal";

export type ShellPanel = "account" | "instances" | "operations";

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

function authModeLabel(
  value: string | undefined,
  t: (source: string) => string,
) {
  return t(
    {
      db_auth: "数据库认证",
      http_auth: "HTTP 认证代理",
      ldap_auth: "LDAP 认证",
      oidc_auth: "OIDC 认证",
      uaa_auth: "UAA 认证",
    }[value ?? ""] ??
      value ??
      "未知认证模式",
  );
}

export function GlobalSearchDialog({
  open,
  onClose,
  navigate,
}: {
  open: boolean;
  onClose: () => void;
  navigate: (path: string) => void;
}) {
  const { locale, t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResults>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useModal({
    open,
    dialogRef,
    onClose,
    initialFocusSelector: 'input[type="search"]',
  });

  useEffect(() => {
    if (!open) return;
    setTerm("");
    setResults(undefined);
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open || term.trim().length < 2) {
      setResults(undefined);
      setError("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void searchApi
        .search(term.trim(), controller.signal)
        .then(setResults)
        .catch((searchError: unknown) => {
          if (
            searchError instanceof DOMException &&
            searchError.name === "AbortError"
          )
            return;
          setError(
            searchError instanceof Error
              ? searchError.message
              : String(searchError),
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 260);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, term]);

  if (!open) return null;
  const projects = results?.project ?? [];
  const repositories = results?.repository ?? [];
  const hasResults = projects.length > 0 || repositories.length > 0;
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="react-search-title"
      >
        <h2 id="react-search-title" className="sr-only">
          {t("全局搜索")}
        </h2>
        <div className="search-input-row">
          <Icon name="search" />
          <input
            ref={inputRef}
            type="search"
            value={term}
            maxLength={200}
            placeholder={t("搜索项目或仓库...")}
            autoComplete="off"
            onChange={(event) => setTerm(event.currentTarget.value)}
          />
          <button
            className="icon-button"
            type="button"
            aria-label={t("关闭搜索")}
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="search-results">
          {term.trim().length < 2 ? (
            <div className="search-hint">{t("输入至少两个字符开始搜索")}</div>
          ) : loading ? (
            <div className="search-hint">
              <div className="spinner" />
              {t("正在搜索...")}
            </div>
          ) : error ? (
            <div className="search-hint">{error}</div>
          ) : !hasResults ? (
            <div className="search-hint">{t("没有找到匹配的项目或仓库")}</div>
          ) : (
            <>
              {projects.length ? (
                <>
                  <span className="search-group-label">{t("项目")}</span>
                  {projects.map((project) => (
                    <button
                      className="search-result"
                      key={`project-${project.name}`}
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(
                          `projects/${encodeURIComponent(project.name)}`,
                        );
                      }}
                    >
                      <span className="cell-stack">
                        <strong>{project.name}</strong>
                        <small>{t("项目")}</small>
                      </span>
                      <Icon name="arrow-right" />
                    </button>
                  ))}
                </>
              ) : null}
              {repositories.length ? (
                <>
                  <span className="search-group-label">{t("仓库")}</span>
                  {repositories.map((repository) => {
                    const name = repository.repository_name;
                    const project = repository.project_name ?? "";
                    return (
                      <button
                        className="search-result"
                        key={`repository-${project}-${name}`}
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(
                            `projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(name)}/artifacts`,
                          );
                        }}
                      >
                        <span className="cell-stack">
                          <strong>{name}</strong>
                          <small>
                            {locale === "en-US"
                              ? `${formatNumber(repository.artifact_count, locale)} artifacts`
                              : `${formatNumber(repository.artifact_count, locale)} 个制品`}
                          </small>
                        </span>
                        <Icon name="arrow-right" />
                      </button>
                    );
                  })}
                </>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function OperationsPanel({ dashboard }: { dashboard: Dashboard }) {
  const { t } = useLocale();
  const warnings = dashboard.warnings ?? [];
  return (
    <>
      <div className="notice-head operation-center-head">
        <div>
          <h2>{t("操作中心")}</h2>
          <span>{t("当前没有运行中的任务")}</span>
        </div>
        <span className="badge">0 {t("个任务")}</span>
      </div>
      {warnings.length ? (
        <section className="operation-warning-list">
          <strong>{t("实例提示")}</strong>
          {warnings.map((warning) => (
            <div className="notice-item" key={warning}>
              <i />
              <div>
                <strong>{t("部分数据读取失败")}</strong>
                <span>{warning}</span>
              </div>
            </div>
          ))}
        </section>
      ) : null}
      <div className="operation-list">
        <div className="operation-empty">
          <Icon name="check" />
          <strong>{t("暂无后台操作")}</strong>
          <span>{t("批量处理和长时间任务会显示在这里。")}</span>
        </div>
      </div>
    </>
  );
}

function AccountPanel({
  session,
  identity,
  authMode,
  navigate,
  openDialog,
}: {
  session: Session;
  identity?: HarborIdentity;
  authMode?: string;
  navigate: (path: string) => void;
  openDialog: (dialog: ShellDialog) => void;
}) {
  const { t } = useLocale();
  const username = identity?.username ?? session.username;
  const role = identity?.sysadmin_flag ? "系统管理员" : "Harbor 用户";
  const canChangePassword = authMode === "db_auth";
  const canChangeCLISecret =
    authMode === "oidc_auth" && Boolean(identity?.oidc_user_meta);
  return (
    <>
      <div className="account-menu-head">
        <span className="user-avatar">
          {username.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>{username}</strong>
          <span>
            {t(role)} · {authModeLabel(authMode, t)}
          </span>
        </div>
      </div>
      <dl className="account-menu-details">
        <div>
          <dt>{t("姓名")}</dt>
          <dd>{identity?.realname ?? t("未填写")}</dd>
        </div>
        <div>
          <dt>{t("邮箱")}</dt>
          <dd>{identity?.email ?? t("未填写")}</dd>
        </div>
      </dl>
      <div className="account-menu-actions">
        <button type="button" onClick={() => openDialog({ kind: "profile" })}>
          <Icon name="edit" />
          <span>{t("编辑个人资料")}</span>
          <Icon name="chevron" />
        </button>
        <button
          type="button"
          disabled={!canChangePassword}
          onClick={() => openDialog({ kind: "password" })}
        >
          <Icon name="shield" />
          <span>
            <strong>{t("修改密码")}</strong>
            <small>
              {t(
                canChangePassword
                  ? "修改当前数据库账号密码"
                  : "仅数据库认证模式可用",
              )}
            </small>
          </span>
          <Icon name="chevron" />
        </button>
        <button
          type="button"
          disabled={!canChangeCLISecret}
          onClick={() => openDialog({ kind: "cli-secret" })}
        >
          <Icon name="terminal" />
          <span>
            <strong>CLI Secret</strong>
            <small>
              {t(
                canChangeCLISecret
                  ? "用于 Docker 或 Helm 客户端"
                  : "仅已绑定的 OIDC 账号可用",
              )}
            </small>
          </span>
          <Icon name="chevron" />
        </button>
        <button
          type="button"
          onClick={() => openDialog({ kind: "preferences" })}
        >
          <Icon name="settings" />
          <span>
            <strong>{t("显示与命令偏好")}</strong>
            <small>{t("时区、CLI 工具和仓库视图")}</small>
          </span>
          <Icon name="chevron" />
        </button>
        <button
          type="button"
          onClick={() => {
            navigate("about");
          }}
        >
          <Icon name="info" />
          <span>
            <strong>{t("关于与 API")}</strong>
            <small>{t("版本、许可证和 Harbor 官方 Swagger")}</small>
          </span>
          <Icon name="chevron" />
        </button>
      </div>
    </>
  );
}

function InstancesPanel({
  instances,
  loading,
  onSwitch,
  onAdd,
  onRemove,
}: {
  instances: HarborInstance[];
  loading: boolean;
  onSwitch: (instance: HarborInstance) => void;
  onAdd: () => void;
  onRemove: (instance: HarborInstance) => void;
}) {
  const { locale, t } = useLocale();
  return (
    <>
      <div className="notice-head">
        <h2>{t("Harbor 实例")}</h2>
        <span className="badge">
          {formatNumber(instances.length, locale)} {t("个实例")}
        </span>
      </div>
      <div className="instance-menu-list">
        {loading ? (
          <div className="route-loading">
            <span className="spinner spinner-small" />
          </div>
        ) : (
          instances.map((instance) => (
            <div
              className={`instance-menu-row${instance.active ? " active" : ""}`}
              key={instance.connection_id}
            >
              <button
                type="button"
                disabled={instance.active}
                onClick={() => onSwitch(instance)}
              >
                <span className="instance-avatar">H</span>
                <span className="instance-menu-meta">
                  <strong>{instanceHost(instance.instance_url)}</strong>
                  <small>
                    {instance.username || "-"} ·{" "}
                    {instance.demo ? t("演示实例") : "Harbor API v2"}
                  </small>
                </span>
                {instance.active ? (
                  <span className="badge badge-green">{t("当前")}</span>
                ) : (
                  <Icon name="chevron" />
                )}
              </button>
              <button
                className="icon-button danger-icon"
                type="button"
                disabled={instances.length <= 1}
                title={t("移除此实例")}
                aria-label={`${t("移除此实例")} ${instanceHost(instance.instance_url)}`}
                onClick={() => onRemove(instance)}
              >
                <Icon name="x" />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="instance-menu-footer">
        <button
          className="button button-small button-primary button-wide"
          type="button"
          onClick={onAdd}
        >
          <Icon name="plus" />
          <span>{t("新增实例")}</span>
        </button>
      </div>
    </>
  );
}

export function ShellNoticePanel({
  panel,
  panelRef,
  session,
  dashboard,
  identity,
  authMode,
  instances,
  instancesLoading,
  navigate,
  openDialog,
  onSwitchInstance,
}: {
  panel?: ShellPanel;
  panelRef: RefObject<HTMLElement | null>;
  session: Session;
  dashboard: Dashboard;
  identity?: HarborIdentity;
  authMode?: string;
  instances: HarborInstance[];
  instancesLoading: boolean;
  navigate: (path: string) => void;
  openDialog: (dialog: ShellDialog) => void;
  onSwitchInstance: (instance: HarborInstance) => void;
}) {
  if (!panel) return null;
  return (
    <aside
      ref={panelRef}
      className="notice-panel"
      data-panel={panel}
      tabIndex={-1}
      aria-label={panel === "account" ? "Account" : "Notifications"}
    >
      {panel === "operations" ? (
        <OperationsPanel dashboard={dashboard} />
      ) : panel === "account" ? (
        <AccountPanel
          session={session}
          identity={identity}
          authMode={authMode}
          navigate={navigate}
          openDialog={openDialog}
        />
      ) : (
        <InstancesPanel
          instances={instances}
          loading={instancesLoading}
          onSwitch={onSwitchInstance}
          onAdd={() => openDialog({ kind: "add-instance" })}
          onRemove={(instance) =>
            openDialog({ kind: "remove-instance", instance })
          }
        />
      )}
    </aside>
  );
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
                <span className="spinner spinner-small" />
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
  const { t } = useLocale();
  const preferences = useMemo(loadPreferences, [dialog]);
  const suggestedSecret = useMemo(generatedCLISecret, [dialog]);
  if (!dialog) return null;
  if (dialog.kind === "add-instance") {
    return (
      <AddInstanceDialog
        demo={session.demo}
        onClose={onClose}
        onSessionChanged={onSessionChanged}
        onNotice={onNotice}
      />
    );
  }
  if (dialog.kind === "remove-instance") {
    const host = instanceHost(dialog.instance.instance_url);
    return (
      <ControlDialog
        title="移除 Harbor 实例"
        subtitle={host}
        submitLabel="移除连接"
        submitIcon="x"
        destructive
        onClose={onClose}
        onSubmit={async () => {
          const current = await instanceApi.remove(
            dialog.instance.connection_id,
          );
          onSessionChanged(current, t("实例连接已移除"));
        }}
      >
        <div className="destructive-message">
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
  if (dialog.kind === "profile") {
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
          await controlApi.mutate(
            "user",
            { id: identity.user_id },
            "PUT",
            next,
          );
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
  if (dialog.kind === "password") {
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
  if (dialog.kind === "cli-secret") {
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
          if (!secretPattern(secret))
            throw new Error(t("密码复杂度不符合要求"));
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
        <div className="warning-banner">
          <Icon name="alert" />
          <span>
            {t("Docker、Helm 和自动化任务需要同步更新为新的 CLI Secret。")}
          </span>
        </div>
      </ControlDialog>
    );
  }
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
