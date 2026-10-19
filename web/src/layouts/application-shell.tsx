import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { instanceApi } from "../app/api-client";
import { instanceHost } from "../app/formatters";
import { useLocale } from "../app/locale-context";
import type {
  Dashboard,
  HarborIdentity,
  HarborInstance,
  HarborPermission,
  Session,
} from "../app/models";
import { HarborBrand } from "../components/harbor-brand";
import { Icon, type IconName } from "../components/icons";
import { LanguageSwitch } from "../components/language-switch";
import { GlobalSearchDialog, ShellNoticePanel } from "./application-overlays";
import { HarborAnnouncement } from "./harbor-announcement";
import { ShellDialogHost, type ShellDialog } from "./shell-dialogs";
import {
  useHarborInstances,
  useSearchShortcut,
  useShellPanel,
  useTheme,
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

function NavGroup({
  label,
  items,
  activeView,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  activeView: string;
  onNavigate: () => void;
}) {
  const { t } = useLocale();
  if (!items.length) return null;
  return (
    <>
      <span className="nav-label">{t(label)}</span>
      {items.map((item) => (
        <a
          key={item.view}
          href={item.href}
          className={activeView === item.view ? "active" : ""}
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

function ShellSidebar({
  open,
  activeView,
  distributionItems,
  systemItems,
  healthy,
  onClose,
  onLogout,
}: {
  /** Open as a drawer on narrow screens. */
  open: boolean;
  activeView: string;
  distributionItems: NavItem[];
  systemItems: NavItem[];
  healthy: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const { t } = useLocale();
  return (
    <aside id="sidebar" className={`sidebar${open ? " open" : ""}`}>
      <div className="sidebar-brand">
        <HarborBrand compact />
        <button
          className="icon-button mobile-only"
          type="button"
          title={t("关闭导航")}
          aria-label={t("关闭导航")}
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </div>
      <nav className="primary-nav" aria-label={t("主导航")}>
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
      <div className="sidebar-footer">
        <div className="health-mini">
          <span
            className={`status-dot ${healthy ? "status-dot-healthy" : "status-dot-unhealthy"}`}
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
}: {
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
}) {
  const { locale, t } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const [ready, setReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dialog, setDialog] = useState<ShellDialog>();
  const health = dashboard.health?.status?.toLowerCase() ?? "healthy";
  const username = identity?.username ?? session.username;
  const operationCenterLabel = t(locale === "zh-CN" ? "操作中心" : "通知");
  const visibleDistribution = useMemo(
    () =>
      distributionItems.filter((item) =>
        hasPermission(identity, permissions, item),
      ),
    [identity, permissions],
  );
  const visibleSystem = useMemo(
    () =>
      systemItems.filter((item) => hasPermission(identity, permissions, item)),
    [identity, permissions],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 220);
    return () => window.clearTimeout(timer);
  }, []);

  const { panel, panelRef, togglePanel, closePanel, focusPanel } =
    useShellPanel();
  const reportInstanceError = useCallback(
    (message: string) => {
      closePanel();
      onNotice(message, true);
    },
    [closePanel, onNotice],
  );
  const { instances, loading: instancesLoading } = useHarborInstances(
    panel === "instances",
    reportInstanceError,
  );
  // Loaded instances replace the spinner; move focus to the first of them.
  useEffect(() => {
    if (!instancesLoading) focusPanel();
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
        onNotice(
          switchError instanceof Error
            ? switchError.message
            : String(switchError),
          true,
        );
      }
    },
    [closePanel, onNotice, onSessionChanged, t],
  );

  return (
    <div id="app-view" className={`app-shell${ready ? " nav-ready" : ""}`}>
      <div
        id="mobile-scrim"
        className="mobile-scrim"
        hidden={!mobileOpen}
        onClick={() => setMobileOpen(false)}
      />
      <ShellSidebar
        open={mobileOpen}
        activeView={activeView}
        distributionItems={visibleDistribution}
        systemItems={visibleSystem}
        healthy={health === "healthy"}
        onClose={() => setMobileOpen(false)}
        onLogout={onLogout}
      />
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            type="button"
            title={t("打开导航")}
            aria-label={t("打开导航")}
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <button
            id="global-search-button"
            className="global-search"
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
          <div className="top-actions">
            <LanguageSwitch compact />
            <button
              id="top-instance-switcher"
              className="top-instance-switcher"
              type="button"
              title={t("切换 Harbor 实例")}
              aria-label={t("切换 Harbor 实例")}
              aria-expanded={panel === "instances"}
              onClick={(event) => togglePanel("instances", event.currentTarget)}
            >
              <Icon name="database" />
              <span>{instanceHost(session.instance_url)}</span>
              <Icon name="chevron" className="top-instance-chevron" />
            </button>
            <button
              className="icon-button"
              type="button"
              title={t("切换主题")}
              aria-label={t("切换主题")}
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              <Icon
                name={theme === "dark" ? "sun" : "moon"}
                className="theme-icon"
              />
            </button>
            <button
              className="icon-button notification-button"
              type="button"
              title={operationCenterLabel}
              aria-label={operationCenterLabel}
              aria-expanded={panel === "operations"}
              onClick={(event) =>
                togglePanel("operations", event.currentTarget)
              }
            >
              <Icon name="bell" />
              <span hidden={(dashboard.warnings?.length ?? 0) === 0} />
            </button>
            <button
              id="account-button"
              className="account-button"
              type="button"
              title={t("账户")}
              aria-label={t("账户")}
              aria-expanded={panel === "account"}
              onClick={(event) => togglePanel("account", event.currentTarget)}
            >
              <span className="user-avatar">
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
          navigate={handleNavigate}
          openDialog={openDialog}
          onSwitchInstance={(instance) => void handleSwitchInstance(instance)}
        />
        <main
          id="main-content"
          className="main-content"
          tabIndex={-1}
          onClickCapture={(event) => {
            // WebKit does not focus mouse-clicked buttons. Capture the opener
            // before a page action mounts a dialog so restoration is consistent.
            if (event.target instanceof Element) {
              event.target.closest("button")?.focus({ preventScroll: true });
            }
          }}
        >
          <div key={contentKey ?? activeView} className="motion-route-enter">
            {children}
          </div>
        </main>
      </div>
      <GlobalSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        navigate={handleNavigate}
      />
      <ShellDialogHost
        dialog={dialog}
        session={session}
        identity={identity}
        onClose={() => setDialog(undefined)}
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
