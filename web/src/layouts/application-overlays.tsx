import { useEffect, useRef, useState, type RefObject } from "react";

import { searchApi } from "../app/api-client";
import { formatNumber, instanceHost } from "../app/formatters";
import { useLocale } from "../app/locale-context";
import type {
  Dashboard,
  HarborIdentity,
  HarborInstance,
  SearchResults,
  Session,
} from "../app/models";
import { Icon } from "../components/icons";
import { useModal } from "../components/use-modal";
import type { ShellDialog } from "./shell-dialogs";

export type ShellPanel = "account" | "instances" | "operations";

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
