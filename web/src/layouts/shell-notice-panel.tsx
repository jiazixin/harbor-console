import { type RefObject } from "react";
import { describeDashboardWarning } from "../app/api-errors";
import { useLocale } from "../app/locale-context";
import type {
  Dashboard,
  HarborIdentity,
  HarborInstance,
  Session,
} from "../app/models";
import { ErrorView } from "../components/error-view";
import { Icon } from "../components/icon";
import uiStyles0 from "../components/shared-ui.module.css";
import { createClassNames } from "../lib/css/class-names";
import { formatNumber, instanceHost } from "../lib/format/formatters";
import { type ShellPanel } from "./application-overlays-support";
import type { ShellDialog } from "./shell-dialogs";
import uiStyles1 from "./shell-notice-panel.module.css";

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

type OperationsPanelProps = { dashboard: Dashboard };

function OperationsPanel({ dashboard }: OperationsPanelProps) {
  const { locale, t } = useLocale();
  const warnings = dashboard.warnings ?? [];
  return (
    <>
      <div className={resolveClasses("notice-head operation-center-head")}>
        <div>
          <h2>{t("操作中心")}</h2>
          <span>{t("当前没有运行中的任务")}</span>
        </div>
        <span className={resolveClasses("badge")}>0 {t("个任务")}</span>
      </div>
      {warnings.length ? (
        <section className={resolveClasses("operation-warning-list")}>
          <strong>{t("实例提示")}</strong>
          {warnings.map((warning) => (
            <div
              className={resolveClasses("notice-item")}
              key={`${warning.source}:${warning.code}`}
            >
              <i />
              <div>
                <strong>{t("部分数据读取失败")}</strong>
                <span>{describeDashboardWarning(warning, locale)}</span>
              </div>
            </div>
          ))}
        </section>
      ) : null}
      <div className={resolveClasses("operation-list")}>
        <div className={resolveClasses("operation-empty")}>
          <Icon name="check" />
          <strong>{t("暂无后台操作")}</strong>
          <span>{t("批量处理和长时间任务会显示在这里。")}</span>
        </div>
      </div>
    </>
  );
}

type AccountPanelProps = {
  session: Session;
  identity?: HarborIdentity;
  authMode?: string;
  navigate: (path: string) => void;
  openDialog: (dialog: ShellDialog) => void;
};

function AccountPanel({
  session,
  identity,
  authMode,
  navigate,
  openDialog,
}: AccountPanelProps) {
  const { t } = useLocale();
  const username = identity?.username ?? session.username;
  const role = identity?.sysadmin_flag ? "系统管理员" : "Harbor 用户";
  const canChangePassword = authMode === "db_auth";
  const canChangeCLISecret =
    authMode === "oidc_auth" && Boolean(identity?.oidc_user_meta);
  return (
    <>
      <div className={resolveClasses("account-menu-head")}>
        <span className={resolveClasses("user-avatar")}>
          {username.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>{username}</strong>
          <span>
            {t(role)} · {authModeLabel(authMode, t)}
          </span>
        </div>
      </div>
      <dl className={resolveClasses("account-menu-details")}>
        <div>
          <dt>{t("姓名")}</dt>
          <dd>{identity?.realname ?? t("未填写")}</dd>
        </div>
        <div>
          <dt>{t("邮箱")}</dt>
          <dd>{identity?.email ?? t("未填写")}</dd>
        </div>
      </dl>
      <div className={resolveClasses("account-menu-actions")}>
        <button
          type="button"
          onClick={() => {
            openDialog({ kind: "profile" });
          }}
        >
          <Icon name="edit" />
          <span>{t("编辑个人资料")}</span>
          <Icon name="chevron" />
        </button>
        <button
          type="button"
          disabled={!canChangePassword}
          onClick={() => {
            openDialog({ kind: "password" });
          }}
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
          onClick={() => {
            openDialog({ kind: "cli-secret" });
          }}
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
          onClick={() => {
            openDialog({ kind: "preferences" });
          }}
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

type InstancesPanelProps = {
  error: string;
  onRetry: () => void;
  instances: HarborInstance[];
  loading: boolean;
  onSwitch: (instance: HarborInstance) => void;
  onAdd: () => void;
  onRemove: (instance: HarborInstance) => void;
};

function InstancesPanel({
  error,
  onRetry,
  instances,
  loading,
  onSwitch,
  onAdd,
  onRemove,
}: InstancesPanelProps) {
  const { locale, t } = useLocale();
  return (
    <>
      <div className={resolveClasses("notice-head")}>
        <h2>{t("Harbor 实例")}</h2>
        <span className={resolveClasses("badge")}>
          {formatNumber(instances.length, locale)} {t("个实例")}
        </span>
      </div>
      {error ? <ErrorView message={error} retry={onRetry} /> : null}
      <div className={resolveClasses("instance-menu-list")}>
        {loading ? (
          <div className={resolveClasses("route-loading")}>
            <span className={resolveClasses("spinner spinner-small")} />
          </div>
        ) : (
          instances.map((instance) => (
            <div
              className={resolveClasses(
                `instance-menu-row${instance.active ? " active" : ""}`,
              )}
              key={instance.connection_id}
            >
              <button
                type="button"
                disabled={instance.active}
                onClick={() => {
                  onSwitch(instance);
                }}
              >
                <span className={resolveClasses("instance-avatar")}>H</span>
                <span className={resolveClasses("instance-menu-meta")}>
                  <strong>{instanceHost(instance.instance_url)}</strong>
                  <small>
                    {instance.username || "-"} ·{" "}
                    {instance.demo ? t("演示实例") : "Harbor API v2"}
                  </small>
                </span>
                {instance.active ? (
                  <span className={resolveClasses("badge badge-green")}>
                    {t("当前")}
                  </span>
                ) : (
                  <Icon name="chevron" />
                )}
              </button>
              <button
                className={resolveClasses("icon-button danger-icon")}
                type="button"
                disabled={instances.length <= 1}
                title={t("移除此实例")}
                aria-label={`${t("移除此实例")} ${instanceHost(instance.instance_url)}`}
                onClick={() => {
                  onRemove(instance);
                }}
              >
                <Icon name="x" />
              </button>
            </div>
          ))
        )}
      </div>
      <div className={resolveClasses("instance-menu-footer")}>
        <button
          className={resolveClasses(
            "button button-small button-primary button-wide",
          )}
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

type ShellNoticePanelProps = {
  panel?: ShellPanel;
  panelRef: RefObject<HTMLElement | null>;
  session: Session;
  dashboard: Dashboard;
  identity?: HarborIdentity;
  authMode?: string;
  instances: HarborInstance[];
  instancesLoading: boolean;
  instancesError: string;
  onRetryInstances: () => void;
  navigate: (path: string) => void;
  openDialog: (dialog: ShellDialog) => void;
  onSwitchInstance: (instance: HarborInstance) => void;
};

export function ShellNoticePanel({
  panel,
  panelRef,
  session,
  dashboard,
  identity,
  authMode,
  instances,
  instancesLoading,
  instancesError,
  onRetryInstances,
  navigate,
  openDialog,
  onSwitchInstance,
}: ShellNoticePanelProps) {
  if (!panel) return null;
  return (
    <aside
      ref={panelRef}
      className={resolveClasses("notice-panel")}
      data-panel={panel}
      tabIndex={-1}
      aria-label={panel === "account" ? "Account" : "Notifications"}
    >
      {(() => {
        if (panel === "operations") {
          return <OperationsPanel dashboard={dashboard} />;
        }
        if (panel === "account") {
          return (
            <AccountPanel
              session={session}
              identity={identity}
              authMode={authMode}
              navigate={navigate}
              openDialog={openDialog}
            />
          );
        }
        return (
          <InstancesPanel
            instances={instances}
            error={instancesError}
            onRetry={onRetryInstances}
            loading={instancesLoading}
            onSwitch={onSwitchInstance}
            onAdd={() => {
              openDialog({ kind: "add-instance" });
            }}
            onRemove={(instance) => {
              openDialog({ kind: "remove-instance", instance });
            }}
          />
        );
      })()}
    </aside>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  badge: uiStyles0.badge,
  "user-avatar": uiStyles0.userAvatar,
  button: uiStyles0.button,
  "route-loading": uiStyles0.routeLoading,
  spinner: uiStyles0.spinner,
  "spinner-small": uiStyles0.spinnerSmall,
  active: uiStyles0.active,
  "badge-green": uiStyles0.badgeGreen,
  "icon-button": uiStyles0.iconButton,
  "danger-icon": uiStyles0.dangerIcon,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  "button-wide": uiStyles0.buttonWide,
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
  "notice-head": uiStyles1.noticeHead,
  "operation-center-head": uiStyles1.operationCenterHead,
  "operation-warning-list": uiStyles1.operationWarningList,
  "notice-item": uiStyles1.noticeItem,
  "operation-list": uiStyles1.operationList,
  "operation-empty": uiStyles1.operationEmpty,
  "account-menu-head": uiStyles1.accountMenuHead,
  "account-menu-details": uiStyles1.accountMenuDetails,
  "account-menu-actions": uiStyles1.accountMenuActions,
  "instance-menu-list": uiStyles1.instanceMenuList,
  "instance-menu-row": uiStyles1.instanceMenuRow,
  "instance-avatar": uiStyles1.instanceAvatar,
  "instance-menu-meta": uiStyles1.instanceMenuMeta,
  "instance-menu-footer": uiStyles1.instanceMenuFooter,
  "notice-panel": uiStyles1.noticePanel,
});
