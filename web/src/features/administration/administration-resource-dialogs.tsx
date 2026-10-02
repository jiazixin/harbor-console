import { useCallback, useEffect, useRef, useState } from "react";

import { controlApi } from "../../app/api-client";
import { formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import {
  createRobotAccount,
  type RobotMutationPayload,
  robotUpdatePayload,
} from "../../app/robot-operations";
import type {
  ControlDataResponse,
  HarborDirectoryUser,
  HarborUser,
  HarborUserGroup,
  PermissionMetadata,
  ProjectLabel,
  ProjectQuota,
  ProjectSummary,
  RobotCredential,
  RobotPermission,
  SystemRobot,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import { RobotCredentialDialog } from "../../components/robot-credential-dialog";
import {
  RobotPermissionMatrix,
  robotAccessFromKeys,
  robotPermissionKey,
  validateRobotAccess,
} from "../../components/robot-permission-matrix";
import { UnifiedSelect } from "../../components/unified-select";

export type AdministrationAction =
  | { kind: "create-user" }
  | { kind: "import-ldap-users" }
  | { kind: "edit-user"; user: HarborUser }
  | { kind: "toggle-user-admin"; user: HarborUser }
  | { kind: "reset-user-password"; user: HarborUser }
  | { kind: "delete-user"; user: HarborUser }
  | { kind: "create-group" }
  | { kind: "edit-group"; group: HarborUserGroup }
  | { kind: "delete-group"; group: HarborUserGroup }
  | { kind: "create-robot" }
  | { kind: "edit-robot"; robot: SystemRobot }
  | { kind: "reset-robot-secret"; robot: SystemRobot }
  | { kind: "delete-robot"; robot: SystemRobot }
  | { kind: "create-label" }
  | { kind: "edit-label"; label: ProjectLabel }
  | { kind: "delete-label"; label: ProjectLabel }
  | { kind: "edit-quota"; quota: ProjectQuota };

function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function DeleteDialog({
  title,
  subtitle,
  submitLabel,
  confirmation,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  submitLabel: string;
  confirmation?: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState("");
  return (
    <ControlDialog
      title={title}
      subtitle={subtitle}
      submitLabel={submitLabel}
      destructive
      submitDisabled={Boolean(confirmation && value !== confirmation)}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
      {confirmation ? (
        <label className="field confirm-field">
          <span>{t("输入名称确认")}</span>
          <input
            name="confirmation"
            required
            autoComplete="off"
            value={value}
            placeholder={confirmation}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
        </label>
      ) : null}
    </ControlDialog>
  );
}

function validateUserComment(value: string, t: (value: string) => string) {
  if (new TextEncoder().encode(value).length > 30) {
    throw new Error(t("用户备注不得超过 30 个 UTF-8 字节"));
  }
}

function UserDialog({
  user,
  onClose,
  onCompleted,
}: {
  user?: HarborUser;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title={user ? "编辑用户" : "新建本地用户"}
      subtitle={user?.username ?? "仅数据库认证模式支持创建本地用户"}
      submitLabel={user ? "保存用户" : "创建用户"}
      onClose={onClose}
      onSubmit={async (formData) => {
        const profile = {
          email: formText(formData, "email").trim(),
          realname: formText(formData, "realname").trim(),
          comment: formText(formData, "comment").trim(),
        };
        validateUserComment(profile.comment, t);
        const payload = user
          ? profile
          : {
              ...profile,
              username: formText(formData, "username").trim(),
              password: formText(formData, "password"),
            };
        await controlApi.mutate(
          user ? "user" : "users",
          user ? { id: user.user_id } : {},
          user ? "PUT" : "POST",
          payload,
        );
        onCompleted(user ? "用户资料已更新" : "用户已创建");
      }}
    >
      <div className="form-grid two-columns">
        {!user ? (
          <>
            <label className="field">
              <span>{t("用户名")}</span>
              <input
                name="username"
                required
                maxLength={255}
                pattern="[A-Za-z0-9_.-]+"
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>{t("初始密码")}</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={4096}
                autoComplete="new-password"
              />
            </label>
          </>
        ) : null}
        <label className="field">
          <span>{t("姓名")}</span>
          <input
            name="realname"
            maxLength={255}
            defaultValue={user?.realname ?? ""}
          />
        </label>
        <label className="field">
          <span>{t("邮箱")}</span>
          <input
            name="email"
            type="email"
            maxLength={255}
            defaultValue={user?.email ?? ""}
          />
        </label>
        <label className="field field-span">
          <span>{t("备注")}</span>
          <textarea
            name="comment"
            rows={3}
            maxLength={30}
            defaultValue={user?.comment ?? ""}
          />
        </label>
      </div>
    </ControlDialog>
  );
}

function LdapImportDialog({
  onClose,
  onCompleted,
}: {
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<HarborDirectoryUser[]>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const controllerRef = useRef<AbortController | undefined>(undefined);

  const search = useCallback(async (term: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const current = requestVersion.current + 1;
    requestVersion.current = current;
    setUsers(undefined);
    setError("");
    try {
      const result = await controlApi.list<HarborDirectoryUser>(
        "ldap-users-search",
        { username: term.trim() },
        controller.signal,
      );
      if (requestVersion.current !== current) return;
      setUsers(result.items);
      setSelected(new Set());
    } catch (searchError) {
      if (
        searchError instanceof DOMException &&
        searchError.name === "AbortError"
      )
        return;
      if (requestVersion.current !== current) return;
      setError(
        searchError instanceof Error
          ? searchError.message
          : String(searchError),
      );
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    void search("");
    return () => controllerRef.current?.abort();
  }, [search]);

  return (
    <ControlDialog
      title="导入 LDAP 用户"
      subtitle="从 Harbor 已配置的 LDAP 目录搜索并导入用户"
      submitLabel="导入已选择用户"
      dialogClass="control-dialog-large"
      onClose={onClose}
      onSubmit={async () => {
        if (!selected.size) throw new Error(t("请至少选择一个 LDAP 用户"));
        await controlApi.mutate("ldap-users-import", {}, "POST", {
          ldap_uid_list: Array.from(selected),
        });
        const message =
          locale === "en-US"
            ? `Submitted ${formatNumber(selected.size, locale)} LDAP users for import`
            : `已提交 ${formatNumber(selected.size, locale)} 个 LDAP 用户导入`;
        onCompleted(message);
      }}
    >
      <div className="directory-search">
        <label className="field">
          <span>{t("用户标识")}</span>
          <input
            type="search"
            maxLength={255}
            autoComplete="off"
            value={query}
            placeholder={t("按 LDAP 用户名搜索")}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void search(query);
            }}
          />
        </label>
        <button
          className="button button-small"
          type="button"
          onClick={() => void search(query)}
        >
          <Icon name="search" />
          <span>{t("搜索目录")}</span>
        </button>
      </div>
      <div className="directory-results">
        {users === undefined ? (
          <div className="dialog-loading">
            <span className="spinner" />
            <span>{t("正在搜索 LDAP 目录...")}</span>
          </div>
        ) : error ? (
          <div className="directory-state directory-state-error">
            <Icon name="alert" />
            <div>
              <strong>{t("LDAP 用户搜索失败")}</strong>
              <span>{error}</span>
            </div>
          </div>
        ) : users.length ? (
          <>
            <div className="directory-result-head">
              <span>{t("目录用户")}</span>
              <span>
                {formatNumber(users.length, locale)} {t("个结果")}
              </span>
            </div>
            <div className="directory-selection-list">
              {users.map((user) => (
                <label className="directory-selection-row" key={user.username}>
                  <input
                    type="checkbox"
                    checked={selected.has(user.username)}
                    onChange={(event) => {
                      const next = new Set(selected);
                      if (event.currentTarget.checked) next.add(user.username);
                      else next.delete(user.username);
                      setSelected(next);
                    }}
                  />
                  <span className="user-avatar-small">
                    {Array.from(user.username || "U")[0]?.toUpperCase() ?? "U"}
                  </span>
                  <span className="cell-stack">
                    <strong>{user.username}</strong>
                    <small>
                      {[user.realname, user.email]
                        .filter(Boolean)
                        .join(" · ") || t("LDAP 用户")}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : (
          <div className="directory-state">
            <Icon name="users" />
            <div>
              <strong>{t("没有匹配的 LDAP 用户")}</strong>
              <span>{t("调整用户名后重新搜索。")}</span>
            </div>
          </div>
        )}
      </div>
    </ControlDialog>
  );
}

function ToggleUserAdminDialog({
  user,
  onClose,
  onCompleted,
}: {
  user: HarborUser;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const { t } = useLocale();
  const currentlyAdmin = user.sysadmin_flag === true;
  return (
    <ControlDialog
      title={currentlyAdmin ? "撤销系统管理员" : "授予系统管理员"}
      subtitle="权限修改将立即生效"
      submitLabel="确认修改"
      destructive={currentlyAdmin}
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate("user-sysadmin", { id: user.user_id }, "PUT", {
          sysadmin_flag: !currentlyAdmin,
        });
        onCompleted("用户系统权限已更新");
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>
          {t(
            currentlyAdmin
              ? "该用户将失去系统级管理权限。"
              : "该用户将可以管理整个 Harbor 实例。",
          )}
        </span>
      </div>
    </ControlDialog>
  );
}

function UserPasswordDialog({
  user,
  onClose,
  onCompleted,
}: {
  user: HarborUser;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="重置用户密码"
      subtitle={user.username}
      submitLabel="更新密码"
      onClose={onClose}
      onSubmit={async (formData) => {
        const password = formText(formData, "new_password");
        if (password !== formText(formData, "confirmation")) {
          throw new Error(t("两次输入的密码不一致"));
        }
        await controlApi.mutate("user-password", { id: user.user_id }, "PUT", {
          new_password: password,
        });
        onCompleted("用户密码已更新");
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>{t("新密码")}</span>
          <input
            name="new_password"
            type="password"
            required
            minLength={8}
            maxLength={4096}
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span>{t("再次输入")}</span>
          <input
            name="confirmation"
            type="password"
            required
            minLength={8}
            maxLength={4096}
            autoComplete="new-password"
          />
        </label>
      </div>
    </ControlDialog>
  );
}

function UserGroupDialog({
  group,
  onClose,
  onCompleted,
}: {
  group?: HarborUserGroup;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const { t } = useLocale();
  const [groupType, setGroupType] = useState<"1" | "2" | "3">(() => {
    const value = String(group?.group_type ?? 3);
    return value === "1" || value === "2" ? value : "3";
  });
  return (
    <ControlDialog
      title={group ? "编辑用户组" : "新建用户组"}
      subtitle="用户组由 Harbor 官方 User Group API 管理"
      submitLabel={group ? "保存用户组" : "创建用户组"}
      onClose={onClose}
      onSubmit={async (formData) => {
        const payload = {
          group_name: formText(formData, "group_name").trim(),
          group_type: Number(formData.get("group_type")),
          ldap_group_dn: formText(formData, "ldap_group_dn").trim(),
        };
        await controlApi.mutate(
          group ? "user-group" : "user-groups",
          group ? { id: group.id } : {},
          group ? "PUT" : "POST",
          payload,
        );
        onCompleted(group ? "用户组已更新" : "用户组已创建");
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>{t("用户组名称")}</span>
          <input
            name="group_name"
            required
            maxLength={255}
            defaultValue={group?.group_name ?? ""}
          />
        </label>
        <label className="field">
          <span>{t("用户组来源")}</span>
          <UnifiedSelect
            ariaLabel={t("用户组来源")}
            name="group_type"
            value={groupType}
            options={[
              { value: "1", label: "LDAP" },
              { value: "2", label: "HTTP" },
              { value: "3", label: "OIDC" },
            ]}
            onChange={setGroupType}
          />
        </label>
        <label className="field">
          <span>{t("LDAP 组 DN")}</span>
          <input
            name="ldap_group_dn"
            maxLength={1024}
            defaultValue={group?.ldap_group_dn ?? ""}
            placeholder={t("LDAP 类型必填")}
          />
        </label>
      </div>
    </ControlDialog>
  );
}

const colorPresets = [
  ["#f48120", "橙色"],
  ["#d97706", "琥珀色"],
  ["#168352", "绿色"],
  ["#0f766e", "青绿色"],
  ["#2878b5", "蓝色"],
  ["#4f5fbf", "靛蓝色"],
  ["#7a4ca0", "紫色"],
  ["#b64276", "玫红色"],
  ["#c73a3a", "红色"],
  ["#6b7280", "灰色"],
  ["#374151", "深灰色"],
  ["#8a5a44", "棕色"],
] as const;

function safeColor(value: string | undefined) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "")
    ? String(value).toLowerCase()
    : "#f48120";
}

function LabelDialog({
  label,
  onClose,
  onCompleted,
}: {
  label?: ProjectLabel;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const { t } = useLocale();
  const [color, setColor] = useState(() => safeColor(label?.color));
  return (
    <ControlDialog
      title={label ? "编辑全局标签" : "新建全局标签"}
      subtitle="适用于当前 Harbor 实例的所有项目"
      submitLabel={label ? "保存标签" : "创建标签"}
      onClose={onClose}
      onSubmit={async (formData) => {
        const payload = {
          name: formText(formData, "name").trim(),
          description: formText(formData, "description").trim(),
          color,
          scope: "g",
          project_id: 0,
        };
        await controlApi.mutate(
          label ? "label" : "labels",
          label ? { id: label.id } : {},
          label ? "PUT" : "POST",
          payload,
        );
        onCompleted(label ? "全局标签已更新" : "全局标签已创建");
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>{t("标签名称")}</span>
          <input
            name="name"
            required
            maxLength={128}
            defaultValue={label?.name ?? ""}
          />
        </label>
        <div className="field global-label-color-field">
          <span>{t("标签颜色")}</span>
          <div
            className="global-label-palette"
            role="group"
            aria-label={t("标签预设颜色")}
          >
            {colorPresets.map(([value, name]) => (
              <button
                key={value}
                type="button"
                className="global-label-color-swatch"
                title={t(name)}
                aria-label={`${t("选择")}${t(name)} ${value}`}
                aria-pressed={value === color}
                onClick={() => setColor(value)}
              >
                <svg
                  className="global-label-preset-fill"
                  viewBox="0 0 30 30"
                  aria-hidden="true"
                  focusable="false"
                >
                  <rect width="30" height="30" fill={value} />
                </svg>
                <span className="global-label-preset-check">
                  {value === color ? <Icon name="check" /> : null}
                </span>
              </button>
            ))}
          </div>
          <div className="global-label-custom-color">
            <input
              type="color"
              value={color}
              aria-label={t("自定义标签颜色")}
              onChange={(event) => setColor(event.currentTarget.value)}
            />
            <span>{t("自定义颜色")}</span>
            <code>{color.toUpperCase()}</code>
          </div>
        </div>
        <label className="field">
          <span>{t("描述")}</span>
          <textarea
            name="description"
            rows={3}
            maxLength={1024}
            defaultValue={label?.description ?? ""}
          />
        </label>
      </div>
    </ControlDialog>
  );
}

function QuotaDialog({
  quota,
  onClose,
  onCompleted,
}: {
  quota: ProjectQuota;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const { t } = useLocale();
  const hard = quota.hard?.storage ?? 0;
  const initial = hard < 0 ? -1 : Number((hard / 1024 ** 3).toFixed(2));
  const project = quota.ref?.name ?? `项目 #${String(quota.ref?.id ?? "-")}`;
  return (
    <ControlDialog
      title="修改项目配额"
      subtitle={project}
      submitLabel="保存配额"
      onClose={onClose}
      onSubmit={async (formData) => {
        const gigabytes = Number(formData.get("storage"));
        const storage = gigabytes < 0 ? -1 : Math.round(gigabytes * 1024 ** 3);
        await controlApi.mutate("quota", { id: quota.id }, "PUT", {
          hard: { storage },
        });
        const persisted = await controlApi.data<ProjectQuota>("quota", {
          id: quota.id,
        });
        if (persisted?.hard?.storage !== storage) {
          throw new Error(t("Harbor 未持久化项目配额，请刷新后重试"));
        }
        onCompleted("项目配额已更新");
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>{t("存储上限（GB）")}</span>
          <input
            name="storage"
            type="number"
            min={-1}
            step={0.1}
            required
            defaultValue={initial}
          />
        </label>
        <p className="field-help">
          {t("输入 -1 表示不限制；修改不会删除已有制品。")}
        </p>
      </div>
    </ControlDialog>
  );
}

function initialRobotKeys(
  robot: SystemRobot | undefined,
  kind: "project" | "system",
  namespace?: string,
) {
  return new Set(
    (robot?.permissions ?? [])
      .filter(
        (permission) =>
          permission.kind === kind &&
          (namespace === undefined || permission.namespace === namespace),
      )
      .flatMap((permission) => permission.access ?? [])
      .map(robotPermissionKey),
  );
}

function SystemRobotDialog({
  robot,
  permissionMetadata,
  projects,
  onClose,
  onCredential,
  onCompleted,
}: {
  robot?: SystemRobot;
  permissionMetadata: PermissionMetadata;
  projects: ProjectSummary[];
  onClose: () => void;
  onCredential: (credential: RobotCredential) => void;
  onCompleted: (message: string) => void;
}) {
  const { locale, t } = useLocale();
  const allProjectPermission = robot?.permissions?.find(
    (permission) =>
      permission.kind === "project" && permission.namespace === "*",
  );
  const initialSelectedProjects = new Set(
    (robot?.permissions ?? [])
      .filter(
        (permission) =>
          permission.kind === "project" &&
          permission.namespace &&
          permission.namespace !== "*",
      )
      .map((permission) => String(permission.namespace)),
  );
  const [name, setName] = useState(() =>
    robot ? robot.name.replace(/^robot\$/, "") : "",
  );
  const [description, setDescription] = useState(robot?.description ?? "");
  const [duration, setDuration] = useState(
    robot?.duration === -1 ? 90 : Math.max(1, robot?.duration ?? 90),
  );
  const [forever, setForever] = useState(robot?.duration === -1);
  const [disabled, setDisabled] = useState(robot?.disable === true);
  const [systemKeys, setSystemKeys] = useState(() =>
    initialRobotKeys(robot, "system"),
  );
  const [projectScope, setProjectScope] = useState<"all" | "none" | "selected">(
    allProjectPermission
      ? "all"
      : initialSelectedProjects.size
        ? "selected"
        : "none",
  );
  const [allProjectKeys, setAllProjectKeys] = useState(
    () => new Set((allProjectPermission?.access ?? []).map(robotPermissionKey)),
  );
  const [selectedProjects, setSelectedProjects] = useState(
    initialSelectedProjects,
  );
  const [activeProject, setActiveProject] = useState(
    () => initialSelectedProjects.values().next().value,
  );
  const [projectKeys, setProjectKeys] = useState(() => {
    const result = new Map<string, Set<string>>();
    projects.forEach((project) =>
      result.set(
        project.name,
        initialRobotKeys(robot, "project", project.name),
      ),
    );
    return result;
  });

  const projectCandidates = permissionMetadata.project ?? [];
  const systemCandidates = permissionMetadata.system ?? [];
  const activeKeys = activeProject
    ? (projectKeys.get(activeProject) ?? new Set<string>())
    : new Set<string>();

  return (
    <ControlDialog
      title={robot ? "编辑系统机器人" : "新建系统机器人"}
      subtitle="系统权限和项目权限均来自 Harbor 官方权限元数据"
      submitLabel={robot ? "保存账号" : "创建账号"}
      dialogClass="control-dialog-wide"
      onClose={onClose}
      onSubmit={async () => {
        const permissions: RobotPermission[] = [];
        const systemAccess = robotAccessFromKeys(systemKeys);
        if (systemAccess.length)
          permissions.push({
            kind: "system",
            namespace: "/",
            access: systemAccess,
          });
        if (projectScope === "all") {
          const access = robotAccessFromKeys(allProjectKeys);
          validateRobotAccess(access, t, t("全部项目"));
          permissions.push({ kind: "project", namespace: "*", access });
        } else if (projectScope === "selected") {
          if (!selectedProjects.size)
            throw new Error(t("请选择至少一个项目，或改为不授予项目权限"));
          projects.forEach((project) => {
            if (!selectedProjects.has(project.name)) return;
            const access = robotAccessFromKeys(
              projectKeys.get(project.name) ?? new Set(),
            );
            validateRobotAccess(access, t, project.name);
            permissions.push({
              kind: "project",
              namespace: project.name,
              access,
            });
          });
        }
        if (!permissions.length)
          throw new Error(t("请至少授予一项系统权限或项目权限"));
        const payload: RobotMutationPayload = {
          name: robot?.name ?? name.trim(),
          description: description.trim(),
          level: "system",
          duration: forever ? -1 : duration,
          disable: disabled,
          permissions,
        };
        if (robot) {
          await controlApi.mutate(
            "robot",
            { id: robot.id },
            "PUT",
            robotUpdatePayload(payload),
          );
          onCompleted("系统机器人已更新");
          return;
        }
        const credential = await createRobotAccount(payload, {
          missingId: t("Harbor 未返回机器人编号，无法停用新账号"),
          missingSecret: t("Harbor 未返回机器人密钥"),
        });
        onCredential(credential);
      }}
    >
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("账号名称")}</span>
          <input
            required
            maxLength={255}
            value={name}
            disabled={Boolean(robot)}
            autoComplete="off"
            placeholder={t("例如 global-mirror")}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <div className="robot-duration-control">
          <label className="field">
            <span>{t("有效期（天）")}</span>
            <input
              type="number"
              min={1}
              required={!forever}
              disabled={forever}
              value={duration}
              onChange={(event) =>
                setDuration(Math.max(1, Number(event.currentTarget.value) || 1))
              }
            />
          </label>
          <label className="robot-duration-forever">
            <input
              type="checkbox"
              checked={forever}
              onChange={(event) => setForever(event.currentTarget.checked)}
            />
            <span>{t("永不过期")}</span>
          </label>
          <small className="field-help">
            {t("勾选后自动向 Harbor 提交 -1；0 不是有效值。")}
          </small>
        </div>
        <label className="field field-span">
          <span>{t("描述")}</span>
          <input
            maxLength={1024}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
        <label className="check-row field-span">
          <input
            type="checkbox"
            checked={disabled}
            onChange={(event) => setDisabled(event.currentTarget.checked)}
          />
          <span>
            <strong>{t("停用账号")}</strong>
            <small>{t("保留权限配置但禁止认证")}</small>
          </span>
        </label>
      </div>
      <RobotPermissionMatrix
        candidates={systemCandidates}
        selected={systemKeys}
        legend="系统权限"
        onChange={setSystemKeys}
      />
      <section className="robot-project-scope">
        <div className="section-heading compact-heading">
          <div>
            <h3>{t("项目权限")}</h3>
            <p>{t("可不授予、覆盖全部项目，或分别配置指定项目。")}</p>
          </div>
          <label className="field scope-select">
            <span>{t("授权范围")}</span>
            <UnifiedSelect
              ariaLabel={t("授权范围")}
              value={projectScope}
              options={[
                { value: "none", label: t("不授予项目权限") },
                { value: "all", label: t("全部项目") },
                { value: "selected", label: t("指定项目") },
              ]}
              onChange={setProjectScope}
            />
          </label>
        </div>
        {projectScope === "all" ? (
          <RobotPermissionMatrix
            candidates={projectCandidates}
            selected={allProjectKeys}
            legend="全部项目权限"
            compact
            onChange={setAllProjectKeys}
          />
        ) : projectScope === "selected" ? (
          projects.length ? (
            <div className="system-project-editor">
              <div className="system-project-list">
                {projects.map((project) => {
                  const selected = selectedProjects.has(project.name);
                  const active = activeProject === project.name;
                  return (
                    <article
                      className={`system-project-permission${active ? " active" : ""}`}
                      key={project.name}
                    >
                      <label className="system-project-choice">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => {
                            const next = new Set(selectedProjects);
                            if (event.currentTarget.checked) {
                              next.add(project.name);
                              setActiveProject(project.name);
                            } else {
                              next.delete(project.name);
                              if (active)
                                setActiveProject(next.values().next().value);
                            }
                            setSelectedProjects(next);
                          }}
                        />
                        <span>
                          <strong>{project.name}</strong>
                          <small>
                            {formatNumber(project.repo_count, locale)}{" "}
                            {t("个仓库")}
                          </small>
                        </span>
                      </label>
                      <button
                        className="icon-button"
                        type="button"
                        disabled={!selected}
                        title={`${t("配置")} ${project.name} ${t("权限")}`}
                        aria-label={`${t("配置")} ${project.name} ${t("权限")}`}
                        onClick={() => setActiveProject(project.name)}
                      >
                        <Icon name="settings" />
                      </button>
                    </article>
                  );
                })}
              </div>
              <div className="system-project-details">
                {activeProject && selectedProjects.has(activeProject) ? (
                  <RobotPermissionMatrix
                    candidates={projectCandidates}
                    selected={activeKeys}
                    legend={`${activeProject} 的权限`}
                    compact
                    onChange={(keys) =>
                      setProjectKeys((current) =>
                        new Map(current).set(activeProject, keys),
                      )
                    }
                  />
                ) : (
                  <div className="system-project-empty">
                    <Icon name="folder" />
                    <strong>{t("选择一个项目")}</strong>
                    <span>{t("勾选项目后，在这里配置它的 Harbor 权限。")}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="warning-banner">
              <Icon name="alert" />
              <span>{t("当前账号看不到可授权的项目。")}</span>
            </div>
          )
        ) : null}
      </section>
    </ControlDialog>
  );
}

export function AdministrationDialog({
  action,
  authMode,
  permissionMetadata,
  projects,
  onClose,
  onCompleted,
  onNotice,
}: {
  action: AdministrationAction;
  authMode: string;
  permissionMetadata: PermissionMetadata;
  projects: ProjectSummary[];
  onClose: () => void;
  onCompleted: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const [credential, setCredential] = useState<RobotCredential>();

  if (credential) {
    return (
      <RobotCredentialDialog
        credential={credential}
        onClose={() =>
          onCompleted(
            action.kind === "create-robot"
              ? "系统机器人已创建"
              : "机器人密钥已重置",
          )
        }
        onCopied={(error) =>
          onNotice(error ? "复制失败" : "已复制到剪贴板", error)
        }
      />
    );
  }
  if (action.kind === "create-user") {
    if (authMode !== "db_auth") return null;
    return <UserDialog onClose={onClose} onCompleted={onCompleted} />;
  }
  if (action.kind === "import-ldap-users") {
    if (authMode !== "ldap_auth") return null;
    return <LdapImportDialog onClose={onClose} onCompleted={onCompleted} />;
  }
  if (action.kind === "edit-user")
    return (
      <UserDialog
        user={action.user}
        onClose={onClose}
        onCompleted={onCompleted}
      />
    );
  if (action.kind === "toggle-user-admin")
    return (
      <ToggleUserAdminDialog
        user={action.user}
        onClose={onClose}
        onCompleted={onCompleted}
      />
    );
  if (action.kind === "reset-user-password")
    return (
      <UserPasswordDialog
        user={action.user}
        onClose={onClose}
        onCompleted={onCompleted}
      />
    );
  if (action.kind === "delete-user")
    return (
      <DeleteDialog
        title="删除用户"
        subtitle={`用户 ${action.user.username} 将被 Harbor 标记为已删除，并失去所有访问权限。`}
        submitLabel="删除用户"
        confirmation={action.user.username}
        onClose={onClose}
        onSubmit={async () => {
          await controlApi.mutate(
            "user",
            { id: action.user.user_id },
            "DELETE",
          );
          onCompleted("用户已删除");
        }}
      />
    );
  if (action.kind === "create-group")
    return <UserGroupDialog onClose={onClose} onCompleted={onCompleted} />;
  if (action.kind === "edit-group")
    return (
      <UserGroupDialog
        group={action.group}
        onClose={onClose}
        onCompleted={onCompleted}
      />
    );
  if (action.kind === "delete-group")
    return (
      <DeleteDialog
        title="删除用户组"
        subtitle={`用户组 ${action.group.group_name} 将从 Harbor 中删除。`}
        submitLabel="删除用户组"
        onClose={onClose}
        onSubmit={async () => {
          await controlApi.mutate(
            "user-group",
            { id: action.group.id },
            "DELETE",
          );
          onCompleted("用户组已删除");
        }}
      />
    );
  if (action.kind === "create-robot" || action.kind === "edit-robot")
    return (
      <SystemRobotDialog
        robot={action.kind === "edit-robot" ? action.robot : undefined}
        permissionMetadata={permissionMetadata}
        projects={projects}
        onClose={onClose}
        onCredential={setCredential}
        onCompleted={onCompleted}
      />
    );
  if (action.kind === "reset-robot-secret")
    return (
      <ControlDialog
        title="重置机器人密钥"
        subtitle="旧密钥将立即失效"
        submitLabel="重置密钥"
        destructive
        onClose={onClose}
        onSubmit={async () => {
          const response = await controlApi.mutate<
            ControlDataResponse<Pick<RobotCredential, "secret">>
          >("robot", { id: action.robot.id }, "PATCH", { secret: "" });
          if (!response.data?.secret)
            throw new Error(t("Harbor 未返回机器人密钥"));
          setCredential({
            name: action.robot.name,
            secret: response.data.secret,
          });
        }}
      >
        <div className="destructive-message">
          <Icon name="alert" />
          <span>{t("使用旧密钥的流水线需要同步更新")}</span>
        </div>
      </ControlDialog>
    );
  if (action.kind === "delete-robot")
    return (
      <DeleteDialog
        title="删除系统机器人"
        subtitle={`账号 ${action.robot.name} 将立即失去全部系统和项目访问权限。`}
        submitLabel="删除账号"
        onClose={onClose}
        onSubmit={async () => {
          await controlApi.mutate("robot", { id: action.robot.id }, "DELETE");
          onCompleted("系统机器人已删除");
        }}
      />
    );
  if (action.kind === "create-label")
    return <LabelDialog onClose={onClose} onCompleted={onCompleted} />;
  if (action.kind === "edit-label")
    return (
      <LabelDialog
        label={action.label}
        onClose={onClose}
        onCompleted={onCompleted}
      />
    );
  if (action.kind === "delete-label")
    return (
      <DeleteDialog
        title="删除全局标签"
        subtitle={`标签 ${action.label.name} 将从实例和所有已绑定制品中移除。`}
        submitLabel="删除标签"
        onClose={onClose}
        onSubmit={async () => {
          await controlApi.mutate("label", { id: action.label.id }, "DELETE");
          onCompleted("全局标签已删除");
        }}
      />
    );
  return (
    <QuotaDialog
      quota={action.quota}
      onClose={onClose}
      onCompleted={onCompleted}
    />
  );
}
