import { ContentTransition } from "../../components/content-transition";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { controlApi } from "../../app/api-client";
import { formatBytes, formatDate, formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type {
  AuditPurgeJob,
  ControlList,
  GarbageCollectionJob,
  HarborUser,
  HarborUserGroup,
  HarborScheduleConfiguration,
  HarborConfiguration,
  JobServicePool,
  JobServiceQueue,
  JobServiceSchedule,
  JobServiceScheduleStatus,
  JobServiceWorker,
  PermissionMetadata,
  ProjectLabel,
  ProjectQuota,
  ProjectSummary,
  ScanAllMetrics,
  CveAllowlist,
  SystemRobot,
} from "../../app/models";
import { Pagination } from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { Icon, type IconName } from "../../components/icons";
import { OverflowText } from "../../components/overflow-text";
import { ToolbarSearchForm } from "../../components/toolbar-search-form";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
  SectionHeading,
} from "../../components/page-elements";
import {
  AdministrationDialog,
  type AdministrationAction,
} from "./administration-resource-dialogs";
import {
  AdministrationConfigurationSection,
  type ConfigurationData,
} from "./administration-configuration";
import {
  AdministrationJobServiceSection,
  AdministrationMaintenanceSection,
  AdministrationPurgeSection,
  type JobServiceData,
  type MaintenanceData,
  type PurgeData,
} from "./administration-operations";

export type AdministrationSection =
  | "users"
  | "groups"
  | "robots"
  | "labels"
  | "quotas"
  | "maintenance"
  | "purge"
  | "jobs"
  | "configuration";

const resourceSections = new Set<AdministrationSection>([
  "users",
  "groups",
  "robots",
  "labels",
  "quotas",
]);

const implementedSections = new Set<AdministrationSection>([
  ...resourceSections,
  "maintenance",
  "purge",
  "jobs",
  "configuration",
]);

const tabs: { key: AdministrationSection; label: string; icon: IconName }[] = [
  { key: "users", label: "用户", icon: "users" },
  { key: "groups", label: "用户组", icon: "users" },
  { key: "robots", label: "机器人账号", icon: "terminal" },
  { key: "labels", label: "全局标签", icon: "tag" },
  { key: "quotas", label: "项目配额", icon: "database" },
  { key: "maintenance", label: "维护任务", icon: "history" },
  { key: "purge", label: "审计清理", icon: "trash" },
  { key: "jobs", label: "任务监控", icon: "terminal" },
  { key: "configuration", label: "系统配置", icon: "settings" },
];

type AdministrationResourceData =
  | { section: "users"; collection: ControlList<HarborUser> }
  | { section: "groups"; collection: ControlList<HarborUserGroup> }
  | {
      section: "robots";
      collection: ControlList<SystemRobot>;
      permissionMetadata: PermissionMetadata;
      projects: ProjectSummary[];
    }
  | { section: "labels"; collection: ControlList<ProjectLabel> }
  | { section: "quotas"; collection: ControlList<ProjectQuota> };

type AdministrationData =
  | AdministrationResourceData
  | MaintenanceData
  | PurgeData
  | JobServiceData
  | ConfigurationData;

function fallbackText(value: string | undefined, fallback = "-"): string {
  return value?.trim() ? value : fallback;
}

function parseSection(route: ConsoleRoute): AdministrationSection {
  const section = route.segments[1] as AdministrationSection | undefined;
  return section && tabs.some((tab) => tab.key === section) ? section : "users";
}

function routePath(section: AdministrationSection, page = 1, filter = "") {
  const query = new URLSearchParams();
  if (page > 1) query.set("page", String(page));
  if (filter) query.set("q", filter);
  return `administration/${section}${query.size ? `?${query}` : ""}`;
}

async function loadAllProjects(signal: AbortSignal): Promise<ProjectSummary[]> {
  const projects: ProjectSummary[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await controlApi.list<ProjectSummary>(
      "projects",
      { page, page_size: 100, sort: "name" },
      signal,
    );
    projects.push(...result.items);
    if (projects.length >= result.pagination.total || result.items.length < 100)
      break;
  }
  return projects;
}

function loadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadOptionalObject<T extends object>(
  operation: string,
  parameters: Record<string, boolean | number | string> = {},
  fallback: T,
  signal: AbortSignal,
): Promise<T & { load_error?: string }> {
  try {
    return (
      (await controlApi.data<T>(operation, parameters, signal)) ?? fallback
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    return { ...fallback, load_error: loadErrorMessage(error) };
  }
}

async function loadOptionalArray<T>(
  operation: string,
  parameters: Record<string, boolean | number | string> = {},
  signal: AbortSignal,
): Promise<T[]> {
  try {
    return (await controlApi.data<T[]>(operation, parameters, signal)) ?? [];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    return [];
  }
}

async function loadOptionalList<T>(
  operation: string,
  parameters: Record<string, boolean | number | string>,
  signal: AbortSignal,
): Promise<ControlList<T>> {
  try {
    return await controlApi.list<T>(operation, parameters, signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    return {
      items: [],
      pagination: {
        page: Number(parameters.page) || 1,
        page_size: Number(parameters.page_size) || 20,
        total: 0,
      },
    };
  }
}

function normalizeAuditEvents(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item) return [item];
    if (!item || typeof item !== "object") return [];
    const eventType = (item as { event_type?: unknown }).event_type;
    return typeof eventType === "string" && eventType ? [eventType] : [];
  });
}

async function loadAdministrationData(
  section: AdministrationSection,
  page: number,
  filter: string,
  signal: AbortSignal,
): Promise<AdministrationData | undefined> {
  if (section === "users") {
    return {
      section,
      collection: await controlApi.list<HarborUser>(
        "users",
        {
          page,
          page_size: 20,
          sort: "username",
          q: filter ? `username=~${filter}` : "",
        },
        signal,
      ),
    };
  }
  if (section === "groups") {
    return {
      section,
      collection: await controlApi.list<HarborUserGroup>(
        "user-groups",
        { page, page_size: 20, group_name: filter },
        signal,
      ),
    };
  }
  if (section === "robots") {
    const [collection, permissionMetadata, projects] = await Promise.all([
      controlApi.list<SystemRobot>(
        "robots",
        {
          page,
          page_size: 20,
          sort: "name",
          q: ["Level=system", filter ? `Name=~${filter}` : ""]
            .filter(Boolean)
            .join(","),
        },
        signal,
      ),
      controlApi.data<PermissionMetadata>("permissions", {}, signal),
      loadAllProjects(signal),
    ]);
    return {
      section,
      collection,
      permissionMetadata: permissionMetadata ?? {},
      projects,
    };
  }
  if (section === "labels") {
    return {
      section,
      collection: await controlApi.list<ProjectLabel>(
        "labels",
        {
          page,
          page_size: 20,
          sort: "name",
          scope: "g",
          name: filter,
        },
        signal,
      ),
    };
  }
  if (section === "quotas") {
    return {
      section,
      collection: await controlApi.list<ProjectQuota>(
        "quotas",
        { page, page_size: 20, sort: "hard.storage" },
        signal,
      ),
    };
  }
  if (section === "maintenance") {
    const [collection, gcSchedule, scanSchedule, scanMetrics] =
      await Promise.all([
        controlApi.list<GarbageCollectionJob>(
          "gc-history",
          { page, page_size: 10, sort: "-creation_time" },
          signal,
        ),
        loadOptionalObject<HarborScheduleConfiguration>(
          "gc-schedule",
          {},
          {},
          signal,
        ),
        loadOptionalObject<HarborScheduleConfiguration>(
          "scan-all-schedule",
          {},
          {},
          signal,
        ),
        loadOptionalObject<ScanAllMetrics>("scan-all-metrics", {}, {}, signal),
      ]);
    return {
      section,
      collection,
      gcSchedule,
      scanSchedule,
      scanMetrics,
    };
  }
  if (section === "purge") {
    const [collection, purgeSchedule, auditEventsValue] = await Promise.all([
      loadOptionalList<AuditPurgeJob>(
        "purge-history",
        { page, page_size: 20, sort: "-creation_time" },
        signal,
      ),
      loadOptionalObject<HarborScheduleConfiguration>(
        "purge-schedule",
        {},
        {},
        signal,
      ),
      loadOptionalArray<unknown>("audit-log-events", {}, signal),
    ]);
    return {
      section,
      collection,
      purgeSchedule,
      auditEvents: normalizeAuditEvents(auditEventsValue),
    };
  }
  if (section === "jobs") {
    const [pools, workers, queues, schedules, scheduleStatus] =
      await Promise.all([
        loadOptionalArray<JobServicePool>("jobservice-pools", {}, signal),
        loadOptionalArray<JobServiceWorker>(
          "jobservice-workers",
          { pool: "all" },
          signal,
        ),
        loadOptionalArray<JobServiceQueue>("jobservice-queues", {}, signal),
        loadOptionalList<JobServiceSchedule>(
          "jobservice-schedules",
          { page, page_size: 20 },
          signal,
        ),
        loadOptionalObject<JobServiceScheduleStatus>(
          "jobservice-schedule-status",
          { type: "all" },
          {},
          signal,
        ),
      ]);
    return {
      section,
      pools,
      workers,
      queues,
      schedules,
      scheduleStatus,
    };
  }
  const [configuration, allowlistResult, auditEventsResult] = await Promise.all(
    [
      controlApi.data<HarborConfiguration>("configurations", {}, signal),
      controlApi
        .data<CveAllowlist>("system-cve-allowlist", {}, signal)
        .then((value) => ({ value }))
        .catch((error: unknown) => ({ error: loadErrorMessage(error) })),
      controlApi
        .data<unknown[]>("audit-log-events", {}, signal)
        .then((value) => ({ value }))
        .catch((error: unknown) => ({ error: loadErrorMessage(error) })),
    ],
  );
  return {
    section,
    configuration: configuration ?? {},
    allowlist: "value" in allowlistResult ? allowlistResult.value : undefined,
    allowlistError:
      "error" in allowlistResult ? allowlistResult.error : undefined,
    auditEvents:
      "value" in auditEventsResult
        ? normalizeAuditEvents(auditEventsResult.value)
        : [],
    auditEventsError:
      "error" in auditEventsResult ? auditEventsResult.error : undefined,
  };
}

function EmptyTable({
  title,
  message,
  icon,
}: {
  title: string;
  message: string;
  icon: IconName;
}) {
  const { t } = useLocale();
  return <EmptyState title={t(title)} description={t(message)} icon={icon} />;
}

function SearchToolbar({
  filter,
  placeholder,
  action,
  onSearch,
}: {
  filter: string;
  placeholder: string;
  action: ReactNode;
  onSearch: (value: string) => void;
}) {
  const [value, setValue] = useState(filter);
  useEffect(() => setValue(filter), [filter]);

  return (
    <div className="table-toolbar">
      <ToolbarSearchForm
        placeholder={placeholder}
        value={value}
        onChange={setValue}
        onSubmit={onSearch}
      />
      <div className="toolbar-spacer" />
      {action}
    </div>
  );
}

function AdministrationTabs({ selected }: { selected: AdministrationSection }) {
  const { locale, t } = useLocale();
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const navigation = navigationRef.current;
      const active = navigation?.querySelector<HTMLElement>(".active");
      if (
        !navigation ||
        !active ||
        navigation.scrollWidth <= navigation.clientWidth
      )
        return;
      const navigationRect = navigation.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const target =
        navigation.scrollLeft +
        activeRect.left -
        navigationRect.left -
        (navigation.clientWidth - activeRect.width) / 2;
      navigation.scrollLeft = Math.max(
        0,
        Math.min(target, navigation.scrollWidth - navigation.clientWidth),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [locale, selected]);

  return (
    <nav
      ref={navigationRef}
      className="resource-tabs administration-tabs"
      aria-label={t("系统管理页面")}
    >
      {tabs.map((tab) => (
        <a
          key={tab.key}
          href={`#/${routePath(tab.key)}`}
          className={selected === tab.key ? "active" : undefined}
          aria-current={selected === tab.key ? "page" : undefined}
        >
          <Icon name={tab.icon} />
          <span>{t(tab.label)}</span>
        </a>
      ))}
    </nav>
  );
}

function RowActions({ children }: { children: ReactNode }) {
  return <div className="row-actions">{children}</div>;
}

function ActionButton({
  label,
  icon,
  danger = false,
  onClick,
}: {
  label: string;
  icon: IconName;
  danger?: boolean;
  onClick: () => void;
}) {
  const { t } = useLocale();
  return (
    <button
      className={`icon-button${danger ? " danger-icon" : ""}`}
      type="button"
      title={t(label)}
      aria-label={t(label)}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}

function UsersTable({
  users,
  authMode,
  onAction,
}: {
  users: HarborUser[];
  authMode: string;
  onAction: (action: AdministrationAction) => void;
}) {
  const { locale, t } = useLocale();
  if (!users.length) {
    return (
      <EmptyTable
        title="暂无用户"
        message="当前条件下没有匹配的 Harbor 用户。"
        icon="users"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{t("用户")}</th>
          <th>{t("邮箱")}</th>
          <th>{t("权限")}</th>
          <th className="table-cell-time">{t("创建时间")}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.user_id}>
            <td>
              <div className="cell-title">
                <span className="user-avatar-small">
                  {Array.from(user.username || "U")[0]?.toUpperCase() ?? "U"}
                </span>
                <span className="cell-stack">
                  <OverflowText as="strong">{user.username}</OverflowText>
                  <OverflowText as="small">
                    {user.realname?.trim()
                      ? user.realname
                      : user.comment?.trim()
                        ? user.comment
                        : `${t("用户")} #${String(user.user_id)}`}
                  </OverflowText>
                </span>
              </div>
            </td>
            <td>
              <OverflowText>{fallbackText(user.email)}</OverflowText>
            </td>
            <td>
              <span
                className={`badge ${user.sysadmin_flag ? "badge-orange" : "badge-blue"}`}
              >
                {t(user.sysadmin_flag ? "系统管理员" : "普通用户")}
              </span>
            </td>
            <td className="table-cell-time">
              {formatDate(user.creation_time, locale)}
            </td>
            <td>
              <RowActions>
                <ActionButton
                  label={user.sysadmin_flag ? "撤销管理员" : "设为管理员"}
                  icon="shield"
                  onClick={() => onAction({ kind: "toggle-user-admin", user })}
                />
                {authMode === "db_auth" ? (
                  <ActionButton
                    label="重置密码"
                    icon="refresh"
                    onClick={() =>
                      onAction({ kind: "reset-user-password", user })
                    }
                  />
                ) : null}
                <ActionButton
                  label="编辑用户"
                  icon="edit"
                  onClick={() => onAction({ kind: "edit-user", user })}
                />
                <ActionButton
                  label="删除用户"
                  icon="trash"
                  danger
                  onClick={() => onAction({ kind: "delete-user", user })}
                />
              </RowActions>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupsTable({
  groups,
  onAction,
}: {
  groups: HarborUserGroup[];
  onAction: (action: AdministrationAction) => void;
}) {
  const { t } = useLocale();
  const groupType = (value: number | undefined) =>
    ({ 1: "LDAP", 2: "HTTP", 3: "OIDC" })[value ?? 0] ?? t("未知");
  if (!groups.length) {
    return (
      <EmptyTable
        title="暂无用户组"
        message="用户组可用于批量授予项目权限。"
        icon="users"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{t("用户组")}</th>
          <th>{t("来源")}</th>
          <th>{t("LDAP DN")}</th>
          <th>{t("编号")}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => (
          <tr key={group.id}>
            <td>
              <div className="cell-title">
                <span className="cell-icon">
                  <Icon name="users" />
                </span>
                <OverflowText as="strong">{group.group_name}</OverflowText>
              </div>
            </td>
            <td>{groupType(group.group_type)}</td>
            <td className="truncate-cell mono">
              {fallbackText(group.ldap_group_dn)}
            </td>
            <td className="mono">#{group.id}</td>
            <td>
              <RowActions>
                <ActionButton
                  label="编辑用户组"
                  icon="edit"
                  onClick={() => onAction({ kind: "edit-group", group })}
                />
                <ActionButton
                  label="删除用户组"
                  icon="trash"
                  danger
                  onClick={() => onAction({ kind: "delete-group", group })}
                />
              </RowActions>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RobotsTable({
  robots,
  onAction,
}: {
  robots: SystemRobot[];
  onAction: (action: AdministrationAction) => void;
}) {
  const { locale, t } = useLocale();
  if (!robots.length) {
    return (
      <EmptyTable
        title="暂无系统机器人"
        message="系统机器人可跨项目执行镜像分发和系统管理操作。"
        icon="terminal"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{t("机器人账号")}</th>
          <th>{t("权限范围")}</th>
          <th>{t("状态")}</th>
          <th className="table-cell-time">{t("到期时间")}</th>
          <th className="table-cell-time">{t("创建时间")}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {robots.map((robot) => {
          const permissions = robot.permissions ?? [];
          const systemCount = permissions
            .filter((permission) => permission.kind === "system")
            .flatMap((permission) => permission.access ?? []).length;
          const projectPermissions = permissions.filter(
            (permission) => permission.kind === "project",
          );
          const allProjects = projectPermissions.some(
            (permission) => permission.namespace === "*",
          );
          const projectLabel = allProjects
            ? t("全部项目")
            : projectPermissions.length
              ? locale === "en-US"
                ? `${formatNumber(projectPermissions.length, locale)} projects`
                : `${formatNumber(projectPermissions.length, locale)} 个项目`
              : t("无项目权限");
          return (
            <tr key={robot.id}>
              <td>
                <div className="cell-title">
                  <span className="cell-icon">
                    <Icon name="terminal" />
                  </span>
                  <span className="cell-stack">
                    <OverflowText as="strong">{robot.name}</OverflowText>
                    <OverflowText as="small">
                      {fallbackText(
                        robot.description,
                        `${t("账号")} #${String(robot.id)}`,
                      )}
                    </OverflowText>
                  </span>
                </div>
              </td>
              <td>
                <span className="badge badge-blue">
                  {t("系统")} {formatNumber(systemCount, locale)} {t("项")}
                </span>{" "}
                <span className={`badge${allProjects ? " badge-orange" : ""}`}>
                  {projectLabel}
                </span>
              </td>
              <td>
                <span
                  className={`badge ${robot.disable ? "badge-red" : "badge-green"}`}
                >
                  {t(robot.disable ? "已停用" : "已启用")}
                </span>
              </td>
              <td className="table-cell-time">
                {robot.expires_at === -1
                  ? t("永不过期")
                  : formatDate(
                      robot.expires_at
                        ? new Date(robot.expires_at * 1000).toISOString()
                        : undefined,
                      locale,
                      false,
                    )}
              </td>
              <td className="table-cell-time">
                {formatDate(robot.creation_time, locale)}
              </td>
              <td>
                <RowActions>
                  <ActionButton
                    label="重置密钥"
                    icon="refresh"
                    onClick={() =>
                      onAction({ kind: "reset-robot-secret", robot })
                    }
                  />
                  <ActionButton
                    label="编辑系统机器人"
                    icon="edit"
                    onClick={() => onAction({ kind: "edit-robot", robot })}
                  />
                  <ActionButton
                    label="删除系统机器人"
                    icon="trash"
                    danger
                    onClick={() => onAction({ kind: "delete-robot", robot })}
                  />
                </RowActions>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function safeLabelColor(value: string | undefined): string {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? String(value) : "#f48120";
}

function LabelsTable({
  labels,
  onAction,
}: {
  labels: ProjectLabel[];
  onAction: (action: AdministrationAction) => void;
}) {
  const { locale, t } = useLocale();
  if (!labels.length) {
    return (
      <EmptyTable
        title="暂无全局标签"
        message="全局标签可绑定到所有项目中的制品。"
        icon="tag"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{t("标签")}</th>
          <th>{t("描述")}</th>
          <th>{t("作用域")}</th>
          <th className="table-cell-time">{t("最近更新")}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {labels.map((label) => (
          <tr key={label.id}>
            <td>
              <div className="cell-title">
                <span
                  className="label-swatch"
                  style={{ backgroundColor: safeLabelColor(label.color) }}
                />
                <OverflowText as="strong">{label.name}</OverflowText>
              </div>
            </td>
            <td>
              <OverflowText>{fallbackText(label.description)}</OverflowText>
            </td>
            <td>
              <span className="badge badge-blue">{t("所有项目")}</span>
            </td>
            <td className="table-cell-time">
              {formatDate(label.update_time ?? label.creation_time, locale)}
            </td>
            <td>
              <RowActions>
                <ActionButton
                  label="编辑全局标签"
                  icon="edit"
                  onClick={() => onAction({ kind: "edit-label", label })}
                />
                <ActionButton
                  label="删除全局标签"
                  icon="trash"
                  danger
                  onClick={() => onAction({ kind: "delete-label", label })}
                />
              </RowActions>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QuotasTable({
  quotas,
  onAction,
}: {
  quotas: ProjectQuota[];
  onAction: (action: AdministrationAction) => void;
}) {
  const { locale, t } = useLocale();
  if (!quotas.length) {
    return (
      <EmptyTable
        title="暂无配额"
        message="当前实例未返回项目配额。"
        icon="database"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{t("项目")}</th>
          <th>{t("已使用")}</th>
          <th>{t("配额上限")}</th>
          <th>{t("使用率")}</th>
          <th className="table-cell-time">{t("最近更新")}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {quotas.map((quota) => {
          const used = quota.used?.storage ?? 0;
          const hard = quota.hard?.storage ?? 0;
          const unlimited = hard < 0;
          const percent =
            !unlimited && hard > 0 ? Math.min(100, (used / hard) * 100) : 0;
          return (
            <tr key={quota.id}>
              <td>
                <div className="cell-title">
                  <span className="cell-icon">
                    <Icon name="folder" />
                  </span>
                  <span className="cell-stack">
                    <strong>
                      {fallbackText(quota.ref?.name, t("未命名项目"))}
                    </strong>
                    <small>{fallbackText(quota.ref?.owner_name)}</small>
                  </span>
                </div>
              </td>
              <td>{formatBytes(used, locale)}</td>
              <td>{unlimited ? t("不限制") : formatBytes(hard, locale)}</td>
              <td>
                <div className="quota-cell">
                  <progress
                    className="quota-track"
                    max={100}
                    value={percent.toFixed(1)}
                    aria-label={
                      unlimited
                        ? t("存储配额无限制")
                        : `${t("存储配额已使用")} ${percent.toFixed(1)}%`
                    }
                  >
                    {percent.toFixed(1)}%
                  </progress>
                  <small>
                    {unlimited ? t("无限制") : `${percent.toFixed(1)}%`}
                  </small>
                </div>
              </td>
              <td className="table-cell-time">
                {formatDate(quota.update_time ?? quota.creation_time, locale)}
              </td>
              <td>
                <ActionButton
                  label="修改配额"
                  icon="edit"
                  onClick={() => onAction({ kind: "edit-quota", quota })}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function authModeLabel(mode: string, t: (value: string) => string): string {
  return t(
    {
      db_auth: "数据库认证",
      ldap_auth: "LDAP 认证",
      oidc_auth: "OIDC 认证",
      uaa_auth: "UAA 认证",
    }[mode] ?? mode,
  );
}

function ResourceSection({
  data,
  filter,
  authMode,
  navigate,
  onAction,
}: {
  data: AdministrationResourceData;
  filter: string;
  authMode: string;
  navigate: (path: string) => void;
  onAction: (action: AdministrationAction) => void;
}) {
  const { locale, t } = useLocale();
  const pageChange = (page: number) =>
    navigate(routePath(data.section, page, filter));
  const heading =
    data.section === "users"
      ? { title: "用户", zhUnit: "个", enUnit: "users" }
      : data.section === "groups"
        ? { title: "用户组", zhUnit: "个", enUnit: "groups" }
        : data.section === "robots"
          ? { title: "系统机器人", zhUnit: "个", enUnit: "robots" }
          : data.section === "labels"
            ? { title: "全局标签", zhUnit: "个", enUnit: "labels" }
            : { title: "项目存储配额", zhUnit: "个", enUnit: "quotas" };

  let toolbar: ReactNode;
  let table: ReactNode;
  if (data.section === "users") {
    const action =
      authMode === "db_auth" ? (
        <button
          className="button button-small button-primary"
          type="button"
          onClick={() => onAction({ kind: "create-user" })}
        >
          <Icon name="plus" />
          <span>{t("新建本地用户")}</span>
        </button>
      ) : authMode === "ldap_auth" ? (
        <button
          className="button button-small button-primary"
          type="button"
          onClick={() => onAction({ kind: "import-ldap-users" })}
        >
          <Icon name="upload" />
          <span>{t("导入 LDAP 用户")}</span>
        </button>
      ) : (
        <span className="toolbar-note">
          {locale === "en-US"
            ? `Users are managed by ${authModeLabel(authMode, t)}`
            : `用户由 ${authModeLabel(authMode, t)} 管理`}
        </span>
      );
    toolbar = (
      <SearchToolbar
        filter={filter}
        placeholder="按用户名搜索"
        action={action}
        onSearch={(value) => navigate(routePath("users", 1, value))}
      />
    );
    table = (
      <UsersTable
        users={data.collection.items}
        authMode={authMode}
        onAction={onAction}
      />
    );
  } else if (data.section === "groups") {
    toolbar = (
      <SearchToolbar
        filter={filter}
        placeholder="按用户组名称搜索"
        action={
          <button
            className="button button-small button-primary"
            type="button"
            onClick={() => onAction({ kind: "create-group" })}
          >
            <Icon name="plus" />
            <span>{t("新建用户组")}</span>
          </button>
        }
        onSearch={(value) => navigate(routePath("groups", 1, value))}
      />
    );
    table = <GroupsTable groups={data.collection.items} onAction={onAction} />;
  } else if (data.section === "robots") {
    toolbar = (
      <SearchToolbar
        filter={filter}
        placeholder="按机器人名称搜索"
        action={
          <button
            className="button button-small button-primary"
            type="button"
            onClick={() => onAction({ kind: "create-robot" })}
          >
            <Icon name="plus" />
            <span>{t("新建系统机器人")}</span>
          </button>
        }
        onSearch={(value) => navigate(routePath("robots", 1, value))}
      />
    );
    table = <RobotsTable robots={data.collection.items} onAction={onAction} />;
  } else if (data.section === "labels") {
    toolbar = (
      <SearchToolbar
        filter={filter}
        placeholder="按标签名称搜索"
        action={
          <button
            className="button button-small button-primary"
            type="button"
            onClick={() => onAction({ kind: "create-label" })}
          >
            <Icon name="plus" />
            <span>{t("新建全局标签")}</span>
          </button>
        }
        onSearch={(value) => navigate(routePath("labels", 1, value))}
      />
    );
    table = <LabelsTable labels={data.collection.items} onAction={onAction} />;
  } else {
    toolbar = (
      <div className="table-toolbar">
        <strong>{t("项目存储配额")}</strong>
        <div className="toolbar-spacer" />
        <span className="toolbar-note">
          {t("配额由 Harbor Quota API 管理")}
        </span>
      </div>
    );
    table = <QuotasTable quotas={data.collection.items} onAction={onAction} />;
  }

  return (
    <section className="table-shell">
      {toolbar}
      <SectionHeading
        title={heading.title}
        total={data.collection.pagination.total}
        zhUnit={heading.zhUnit}
        enUnit={heading.enUnit}
      />
      <div className="table-scroll">{table}</div>
      <Pagination
        pagination={data.collection.pagination}
        onPageChange={pageChange}
      />
    </section>
  );
}

export function AdministrationPage({
  route,
  demo,
  authMode,
  hasRootCertificate,
  refreshing,
  navigate,
  onRefresh,
  onNotice,
}: {
  route: ConsoleRoute;
  demo: boolean;
  authMode: string | undefined;
  hasRootCertificate: boolean;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const section = parseSection(route);
  const page = Math.max(
    1,
    Number.parseInt(route.query.get("page") ?? "1", 10) || 1,
  );
  const filter = route.query.get("q") ?? "";
  const [data, setData] = useState<AdministrationData>();
  const [dialog, setDialog] = useState<AdministrationAction>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const requestVersion = useRef(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    if (!implementedSections.has(section)) return;
    const controller = new AbortController();
    const current = requestVersion.current + 1;
    requestVersion.current = current;
    setData(undefined);
    setError("");
    void loadAdministrationData(section, page, filter, controller.signal)
      .then((result) => {
        if (requestVersion.current === current) setData(result);
      })
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        if (requestVersion.current === current) {
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      });
    return () => controller.abort();
  }, [filter, page, section, version]);

  const robotContext =
    data?.section === "robots"
      ? { permissionMetadata: data.permissionMetadata, projects: data.projects }
      : {
          permissionMetadata: {} as PermissionMetadata,
          projects: [] as ProjectSummary[],
        };

  return (
    <>
      <PageHeader
        title="系统管理"
        subtitle={t("管理用户、配额与后台维护任务")}
        actions={
          <RefreshButton
            refreshing={refreshing}
            onRefresh={() => {
              reload();
              onRefresh();
            }}
          />
        }
      />
      {demo ? <DemoBanner /> : null}
      <AdministrationTabs selected={section} />
      <ContentTransition mode={section}>
        {error ? (
          <div className="loading-state">
            <div>
              <Icon name="alert" />
              <h2>{t("系统管理数据载入失败")}</h2>
              <p>{error}</p>
              <button
                className="button button-small"
                type="button"
                onClick={reload}
              >
                {t("重试")}
              </button>
            </div>
          </div>
        ) : !implementedSections.has(section) || data?.section !== section ? (
          <section className="table-shell">
            <div
              className="route-loading"
              role="status"
              aria-label={t("正在载入")}
            >
              <span className="spinner spinner-small" aria-hidden="true" />
            </div>
          </section>
        ) : data.section === "maintenance" ? (
          <AdministrationMaintenanceSection
            data={data}
            navigate={navigate}
            onReload={reload}
            onNotice={onNotice}
          />
        ) : data.section === "purge" ? (
          <AdministrationPurgeSection
            data={data}
            navigate={navigate}
            onReload={reload}
            onNotice={onNotice}
          />
        ) : data.section === "jobs" ? (
          <AdministrationJobServiceSection
            data={data}
            navigate={navigate}
            onReload={reload}
            onNotice={onNotice}
          />
        ) : data.section === "configuration" ? (
          <AdministrationConfigurationSection
            data={data}
            route={route}
            hasRootCertificate={hasRootCertificate}
            navigate={navigate}
            onReload={reload}
            onNotice={onNotice}
          />
        ) : (
          <ResourceSection
            data={data}
            filter={filter}
            authMode={authMode ?? ""}
            navigate={navigate}
            onAction={setDialog}
          />
        )}
      </ContentTransition>
      {dialog ? (
        <AdministrationDialog
          action={dialog}
          authMode={authMode ?? ""}
          permissionMetadata={robotContext.permissionMetadata}
          projects={robotContext.projects}
          onClose={() => setDialog(undefined)}
          onCompleted={(message) => {
            setDialog(undefined);
            onNotice(message);
            reload();
          }}
          onNotice={onNotice}
        />
      ) : null}
    </>
  );
}
