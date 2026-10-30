import { useTheme } from "../app/theme-provider";
import uiStyles0 from "../components/shared-ui.module.css";
import { createClassNames } from "../lib/css/class-names";
import uiStyles1 from "./application-shell.module.css";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { instanceApi } from "../app/api-client";
import { errorText } from "../app/errors";
import { useLocale } from "../app/locale-context";
import type {
  Dashboard,
  HarborIdentity,
  HarborInstance,
  HarborPermission,
  Session,
} from "../app/models";
import { HarborBrand } from "../components/harbor-brand";
import { Icon } from "../components/icon";
import { type IconName } from "../components/icons-support";
import { LanguageSwitch } from "../components/language-switch";
import { instanceHost } from "../lib/format/formatters";
import { GlobalSearchDialog } from "./global-search-dialog";
import { HarborAnnouncement } from "./harbor-announcement";
import { ShellDialogHost, type ShellDialog } from "./shell-dialogs";
import { ShellNoticePanel } from "./shell-notice-panel";
import {
  useHarborInstances,
  useSearchShortcut,
  useShellPanel,
} from "./use-shell-controls";

type NavItem = {
  view: string;
  href: string;
  label: string;
  icon: IconName;
  admin?: boolean;
  permission?: [string, string];
};

const workspaceItems: NavItem[] = [
  { view: "overview", href: "#/overview", label: "概览", icon: "home" },
  { view: "projects", href: "#/projects", label: "项目中心", icon: "folder" },
  {
    view: "repositories",
    href: "#/repositories",
    label: "镜像仓库",
    icon: "package",
  },
  {
    view: "security",
    href: "#/security",
    label: "制品安全",
    icon: "shield",
    permission: ["security-hub", "read"],
  },
];

const distributionItems: NavItem[] = [
  {
    view: "replication",
    href: "#/replication",
    label: "复制管理",
    icon: "refresh",
    permission: ["replication", "list"],
  },
  {
    view: "registries",
    href: "#/registries",
    label: "远端仓库",
    icon: "database",
    permission: ["registry", "list"],
  },
  {
    view: "preheat",
    href: "#/preheat",
    label: "P2P 分发",
    icon: "play",
    permission: ["preheat-instance", "list"],
  },
  {
    view: "audit",
    href: "#/audit",
    label: "审计日志",
    icon: "history",
    permission: ["audit-log", "list"],
  },
];

const systemItems: NavItem[] = [
  {
    view: "administration",
    href: "#/administration/users",
    label: "管理中心",
    icon: "users",
    admin: true,
  },
  {
    view: "system",
    href: "#/system",
    label: "系统状态",
    icon: "settings",
    permission: ["system-volumes", "read"],
  },
];

function hasPermission(
  identity: HarborIdentity | undefined,
  permissions: HarborPermission[],
  item: NavItem,
): boolean {
  if (identity?.sysadmin_flag) return true;
  if (item.admin) return false;
  if (!item.permission) return true;
  const [resource, action] = item.permission;
  return permissions.some(
    (permission) =>
      (permission.resource === resource || permission.resource === "*") &&
      (permission.action === action || permission.action === "*"),
  );
}

type NavGroupProps = {
  label: string;
  items: NavItem[];
  activeView: string;
  onNavigate: () => void;
};

function NavGroup({ label, items, activeView, onNavigate }: NavGroupProps) {
  const { t } = useLocale();
  if (!items.length) return null;
  return (
    <>
      <span className={resolveClasses("nav-label")}>{t(label)}</span>
      {items.map((item) => (
        <a
          key={item.view}
          href={item.href}
          className={resolveClasses(activeView === item.view ? "active" : "")}
          aria-current={activeView === item.view ? "page" : undefined}
          onClick={onNavigate}
        >
          <Icon name={item.icon} />
          <span>{t(item.label)}</span>
        </a>
      ))}
    </>
  );
}

type ShellSidebarProps = {
  /** Open as a drawer on narrow screens. */
  open: boolean;
  activeView: string;
  distributionItems: NavItem[];
  systemItems: NavItem[];
  healthy: boolean;
  onClose: () => void;
  onLogout: () => void;
};

function ShellSidebar({
  open,
  activeView,
  distributionItems,
  systemItems,
  healthy,
  onClose,
  onLogout,
}: ShellSidebarProps) {
  const { t } = useLocale();
  return (
    <aside
      id="sidebar"
      className={resolveClasses(`sidebar${open ? " open" : ""}`)}
    >
      <div className={resolveClasses("sidebar-brand")}>
        <HarborBrand compact />
        <button
          className={resolveClasses("icon-button mobile-only")}
          type="button"
          title={t("关闭导航")}
          aria-label={t("关闭导航")}
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </div>
      <nav className={resolveClasses("primary-nav")} aria-label={t("主导航")}>
        <NavGroup
          label="工作区"
          items={workspaceItems}
          activeView={activeView}
          onNavigate={onClose}
        />
        <NavGroup
          label="分发与治理"
          items={distributionItems}
          activeView={activeView}
          onNavigate={onClose}
        />
        <NavGroup
          label="系统管理"
          items={systemItems}
          activeView={activeView}
          onNavigate={onClose}
        />
        <NavGroup
          label="产品信息"
          items={[
            {
              view: "about",
              href: "#/about",
              label: "关于与 API",
              icon: "info",
            },
          ]}
          activeView={activeView}
          onNavigate={onClose}
        />
      </nav>
      <div className={resolveClasses("sidebar-footer")}>
        <div className={resolveClasses("health-mini")}>
          <span
            className={resolveClasses(
              `status-dot ${healthy ? "status-dot-healthy" : "status-dot-unhealthy"}`,
            )}
          />
          <span>{t(healthy ? "连接正常" : "实例有异常")}</span>
        </div>
        <button type="button" onClick={onLogout}>
          <Icon name="log-out" />
          <span>{t("断开连接")}</span>
        </button>
      </div>
    </aside>
  );
}

type ApplicationShellProps = {
  session: Session;
  dashboard: Dashboard;
  identity?: HarborIdentity;
  permissions: HarborPermission[];
  activeView: string;
  navigate: (path: string) => void;
  onNotice: (message: string, error?: boolean) => void;
  onIdentityChanged: (identity: HarborIdentity, message: string) => void;
  onSessionChanged: (session: Session, message: string) => void | Promise<void>;
  onLogout: () => void;
  contentKey?: string;
  children: ReactNode;
};

export function ApplicationShell({
  session,
  dashboard,
  identity,
  permissions,
  activeView,
  navigate,
  onNotice,
  onIdentityChanged,
  onSessionChanged,
  onLogout,
  contentKey,
  children,
}: ApplicationShellProps) {
  const { locale, t } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const [ready, setReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dialog, setDialog] = useState<ShellDialog>();
  const health = dashboard.health?.status?.toLowerCase() ?? "healthy";
  const username = identity?.username ?? session.username;
  const operationCenterLabel = t(locale === "zh-CN" ? "操作中心" : "通知");
  const visibleDistribution = (() =>
    distributionItems.filter((item) =>
      hasPermission(identity, permissions, item),
    ))();
  const visibleSystem = (() =>
    systemItems.filter((item) => hasPermission(identity, permissions, item)))();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReady(true);
    }, 220);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const { panel, panelRef, togglePanel, closePanel, focusPanel } =
    useShellPanel();
  const {
    instances,
    loading: instancesLoading,
    error: instancesError,
    reload: reloadInstances,
  } = useHarborInstances(panel === "instances");
  // Loaded instances replace the spinner; move focus to the first of them.
  useEffect(() => {
    if (instancesLoading) return;
    const frame = window.requestAnimationFrame(focusPanel);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [focusPanel, instancesLoading]);
  useSearchShortcut(
    useCallback(() => {
      closePanel(false);
      setSearchOpen(true);
    }, [closePanel]),
  );

  const openDialog = useCallback(
    (next: ShellDialog) => {
      closePanel(false);
      setDialog(next);
    },
    [closePanel],
  );

  const handleNavigate = useCallback(
    (path: string) => {
      closePanel(false);
      setSearchOpen(false);
      navigate(path);
    },
    [closePanel, navigate],
  );

  const handleSwitchInstance = useCallback(
    async (instance: HarborInstance) => {
      if (instance.active) return;
      closePanel(false);
      try {
        const current = await instanceApi.switch(instance.connection_id);
        await onSessionChanged(current, t("Harbor 实例已切换"));
      } catch (switchError) {
        onNotice(errorText(switchError), true);
      }
    },
    [closePanel, onNotice, onSessionChanged, t],
  );

  return (
    <div
      id="app-view"
      className={resolveClasses(`app-shell${ready ? " nav-ready" : ""}`)}
    >
      <div
        id="mobile-scrim"
        className={resolveClasses("mobile-scrim")}
        hidden={!mobileOpen}
        onClick={() => {
          setMobileOpen(false);
        }}
      />
      <ShellSidebar
        open={mobileOpen}
        activeView={activeView}
        distributionItems={visibleDistribution}
        systemItems={visibleSystem}
        healthy={health === "healthy"}
        onClose={() => {
          setMobileOpen(false);
        }}
        onLogout={onLogout}
      />
      <div className={resolveClasses("workspace")}>
        <header className={resolveClasses("topbar")}>
          <button
            className={resolveClasses("icon-button mobile-only")}
            type="button"
            title={t("打开导航")}
            aria-label={t("打开导航")}
            onClick={() => {
              setMobileOpen(true);
            }}
          >
            <Icon name="menu" />
          </button>
          <button
            id="global-search-button"
            className={resolveClasses("global-search")}
            type="button"
            aria-label={t("全局搜索")}
            onClick={(event) => {
              event.currentTarget.focus({ preventScroll: true });
              closePanel(false);
              setSearchOpen(true);
            }}
          >
            <Icon name="search" />
            <span>{t("搜索项目和仓库")}</span>
            <kbd>/</kbd>
          </button>
          <div className={resolveClasses("top-actions")}>
            <LanguageSwitch compact />
            <button
              id="top-instance-switcher"
              className={resolveClasses("top-instance-switcher")}
              type="button"
              title={t("切换 Harbor 实例")}
              aria-label={t("切换 Harbor 实例")}
              aria-expanded={panel === "instances"}
              onClick={(event) => {
                togglePanel("instances", event.currentTarget);
              }}
            >
              <Icon name="database" />
              <span>{instanceHost(session.instance_url)}</span>
              <Icon
                name="chevron"
                className={resolveClasses("top-instance-chevron")}
              />
            </button>
            <button
              className={resolveClasses("icon-button")}
              type="button"
              title={t("切换主题")}
              aria-label={t("切换主题")}
              onClick={() => {
                setTheme((current) => (current === "dark" ? "light" : "dark"));
              }}
            >
              <Icon
                name={theme === "dark" ? "sun" : "moon"}
                className={resolveClasses("theme-icon")}
              />
            </button>
            <button
              className={resolveClasses("icon-button notification-button")}
              type="button"
              title={operationCenterLabel}
              aria-label={operationCenterLabel}
              aria-expanded={panel === "operations"}
              onClick={(event) => {
                togglePanel("operations", event.currentTarget);
              }}
            >
              <Icon name="bell" />
              <span hidden={(dashboard.warnings?.length ?? 0) === 0} />
            </button>
            <button
              id="account-button"
              className={resolveClasses("account-button")}
              type="button"
              title={t("账户")}
              aria-label={t("账户")}
              aria-expanded={panel === "account"}
              onClick={(event) => {
                togglePanel("account", event.currentTarget);
              }}
            >
              <span className={resolveClasses("user-avatar")}>
                {username.slice(0, 1).toUpperCase()}
              </span>
              <span>{username}</span>
              <Icon name="chevron" />
            </button>
          </div>
        </header>
        <HarborAnnouncement rawValue={dashboard.systeminfo?.banner_message} />
        <ShellNoticePanel
          panel={panel}
          panelRef={panelRef}
          session={session}
          dashboard={dashboard}
          identity={identity}
          authMode={dashboard.systeminfo?.auth_mode}
          instances={instances}
          instancesLoading={instancesLoading}
          instancesError={instancesError}
          onRetryInstances={reloadInstances}
          navigate={handleNavigate}
          openDialog={openDialog}
          onSwitchInstance={(instance) => void handleSwitchInstance(instance)}
        />
        <main
          id="main-content"
          className={resolveClasses("main-content")}
          tabIndex={-1}
          onClickCapture={(event) => {
            // WebKit does not focus mouse-clicked buttons. Capture the opener
            // before a page action mounts a dialog so restoration is consistent.
            if (event.target instanceof Element) {
              event.target.closest("button")?.focus({ preventScroll: true });
            }
          }}
        >
          <div
            key={contentKey ?? activeView}
            className={resolveClasses("motion-route-enter")}
          >
            {children}
          </div>
        </main>
      </div>
      <GlobalSearchDialog
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
        }}
        navigate={handleNavigate}
      />
      <ShellDialogHost
        dialog={dialog}
        session={session}
        identity={identity}
        onClose={() => {
          setDialog(undefined);
        }}
        onIdentityChanged={(nextIdentity, message) => {
          setDialog(undefined);
          onIdentityChanged(nextIdentity, message);
        }}
        onSessionChanged={(nextSession, message) => {
          setDialog(undefined);
          void onSessionChanged(nextSession, message);
        }}
        onNotice={onNotice}
      />
    </div>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "language-switch": uiStyles0.languageSwitch,
  active: uiStyles0.active,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
  "user-avatar": uiStyles0.userAvatar,
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
  "nav-label": uiStyles1.navLabel,
  sidebar: uiStyles1.sidebar,
  open: uiStyles1.open,
  "sidebar-brand": uiStyles1.sidebarBrand,
  "mobile-only": uiStyles1.mobileOnly,
  "primary-nav": uiStyles1.primaryNav,
  "sidebar-footer": uiStyles1.sidebarFooter,
  "health-mini": uiStyles1.healthMini,
  "status-dot": uiStyles1.statusDot,
  "status-dot-healthy": uiStyles1.statusDotHealthy,
  "status-dot-unhealthy": uiStyles1.statusDotUnhealthy,
  "app-shell": uiStyles1.appShell,
  "nav-ready": uiStyles1.navReady,
  "mobile-scrim": uiStyles1.mobileScrim,
  workspace: uiStyles1.workspace,
  topbar: uiStyles1.topbar,
  "global-search": uiStyles1.globalSearch,
  "top-actions": uiStyles1.topActions,
  "top-instance-switcher": uiStyles1.topInstanceSwitcher,
  "top-instance-chevron": uiStyles1.topInstanceChevron,
  "notification-button": uiStyles1.notificationButton,
  "account-button": uiStyles1.accountButton,
  "main-content": uiStyles1.mainContent,
  "motion-route-enter": uiStyles1.motionRouteEnter,
});
