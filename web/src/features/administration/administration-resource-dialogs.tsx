import { useState } from "react";
import { controlApi } from "../../app/api-client";
import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type {
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
import {
  createRobotAccount,
  robotUpdatePayload,
  type RobotMutationPayload,
} from "../../app/robot-operations";
import { useControlMutation } from "../../app/use-control-mutation";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { FormTextarea } from "../../components/form-textarea";
import { Icon } from "../../components/icon";
import { RobotCredentialDialog } from "../../components/robot-credential-dialog";
import {
  RobotPermissionMatrix,
  robotAccessFromKeys,
  robotPermissionKey,
  validateRobotAccess,
} from "../../components/robot-permission-matrix";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { formatNumber } from "../../lib/format/formatters";
import { administrationKeys } from "./administration-keys";
import styles from "./administration.module.css";

// Queries that a write in this module can change.
const affectedQueries = [administrationKeys.all];

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

type DeleteDialogProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  confirmation?: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
};

function DeleteDialog({
  title,
  subtitle,
  submitLabel,
  confirmation,
  onClose,
  onSubmit,
}: DeleteDialogProps) {
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
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
      {confirmation ? (
        <label className={resolveClasses("field confirm-field")}>
          <span>{t("输入名称确认")}</span>
          <FormInput
            name="confirmation"
            required
            autoComplete="off"
            value={value}
            placeholder={confirmation}
            onChange={(event) => {
              setValue(event.currentTarget.value);
            }}
          />
        </label>
      ) : null}
    </ControlDialog>
  );
}

function validateUserComment(value: string, t: (value: string) => string) {
  if (new TextEncoder().encode(value).length > 30) {
    throw new UserInputError(t("用户备注不得超过 30 个 UTF-8 字节"));
  }
}

type UserDialogProps = {
  user?: HarborUser;
  onClose: () => void;
  onCompleted: (message: string) => void;
};

function UserDialog({ user, onClose, onCompleted }: UserDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
        await mutate({
          operation: user ? "user" : "users",
          parameters: user ? { id: user.user_id } : {},
          method: user ? "PUT" : "POST",
          payload: payload,
        });
        onCompleted(user ? "用户资料已更新" : "用户已创建");
      }}
    >
      <div className={resolveClasses("form-grid two-columns")}>
        {!user ? (
          <>
            <label className={resolveClasses("field")}>
              <span>{t("用户名")}</span>
              <FormInput
                name="username"
                required
                maxLength={255}
                pattern="[A-Za-z0-9_.\-]+"
                autoComplete="off"
              />
            </label>
            <label className={resolveClasses("field")}>
              <span>{t("初始密码")}</span>
              <FormInput
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
        <label className={resolveClasses("field")}>
          <span>{t("姓名")}</span>
          <FormInput
            name="realname"
            maxLength={255}
            defaultValue={user?.realname ?? ""}
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("邮箱")}</span>
          <FormInput
            name="email"
            type="email"
            maxLength={255}
            defaultValue={user?.email ?? ""}
          />
        </label>
        <label className={resolveClasses("field field-span")}>
          <span>{t("备注")}</span>
          <FormTextarea
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

type LdapImportDialogProps = {
  onClose: () => void;
  onCompleted: (message: string) => void;
};

function LdapImportDialog({ onClose, onCompleted }: LdapImportDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchQuery = useLdapImportData({ term });
  // Every search, repeated ones included, shows the spinner until it settles.
  const users = searchQuery.loading ? undefined : (searchQuery.data ?? []);
  const error = searchQuery.error;

  function search(next: string) {
    setSelected(new Set());
    if (next.trim() === term) searchQuery.reload();
    else setTerm(next.trim());
  }

  return (
    <ControlDialog
      title="导入 LDAP 用户"
      subtitle="从 Harbor 已配置的 LDAP 目录搜索并导入用户"
      submitLabel="导入已选择用户"
      dialogClass={resolveClasses("control-dialog-large")}
      onClose={onClose}
      onSubmit={async () => {
        if (!selected.size)
          throw new UserInputError(t("请至少选择一个 LDAP 用户"));
        await mutate({
          operation: "ldap-users-import",
          parameters: {},
          method: "POST",
          payload: {
            ldap_uid_list: Array.from(selected),
          },
        });
        const message =
          locale === "en-US"
            ? `Submitted ${formatNumber(selected.size, locale)} LDAP users for import`
            : `已提交 ${formatNumber(selected.size, locale)} 个 LDAP 用户导入`;
        onCompleted(message);
      }}
    >
      <div className={resolveClasses("directory-search")}>
        <label className={resolveClasses("field")}>
          <span>{t("用户标识")}</span>
          <FormInput
            type="search"
            maxLength={255}
            autoComplete="off"
            value={query}
            placeholder={t("按 LDAP 用户名搜索")}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              search(query);
            }}
          />
        </label>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          onClick={() => {
            search(query);
          }}
        >
          <Icon name="search" />
          <span>{t("搜索目录")}</span>
        </button>
      </div>
      <div className={resolveClasses("directory-results")}>
        {(() => {
          if (users === undefined) {
            return (
              <div className={resolveClasses("dialog-loading")}>
                <span className={resolveClasses("spinner")} />
                <span>{t("正在搜索 LDAP 目录...")}</span>
              </div>
            );
          }
          if (error) {
            return (
              <div
                className={resolveClasses(
                  "directory-state directory-state-error",
                )}
              >
                <Icon name="alert" />
                <div>
                  <strong>{t("LDAP 用户搜索失败")}</strong>
                  <span>{error}</span>
                </div>
              </div>
            );
          }
          if (users.length) {
            return (
              <>
                <div className={resolveClasses("directory-result-head")}>
                  <span>{t("目录用户")}</span>
                  <span>
                    {formatNumber(users.length, locale)} {t("个结果")}
                  </span>
                </div>
                <div className={resolveClasses("directory-selection-list")}>
                  {users.map((user) => (
                    <label
                      className={resolveClasses("directory-selection-row")}
                      key={user.username}
                    >
                      <FormInput
                        type="checkbox"
                        checked={selected.has(user.username)}
                        onChange={(event) => {
                          const next = new Set(selected);
                          if (event.currentTarget.checked)
                            next.add(user.username);
                          else next.delete(user.username);
                          setSelected(next);
                        }}
                      />
                      <span className={resolveClasses("user-avatar-small")}>
                        {Array.from(user.username || "U")[0]?.toUpperCase() ??
                          "U"}
                      </span>
                      <span className={resolveClasses("cell-stack")}>
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
            );
          }
          return (
            <div className={resolveClasses("directory-state")}>
              <Icon name="users" />
              <div>
                <strong>{t("没有匹配的 LDAP 用户")}</strong>
                <span>{t("调整用户名后重新搜索。")}</span>
              </div>
            </div>
          );
        })()}
      </div>
    </ControlDialog>
  );
}

type ToggleUserAdminDialogProps = {
  user: HarborUser;
  onClose: () => void;
  onCompleted: (message: string) => void;
};

function ToggleUserAdminDialog({
  user,
  onClose,
  onCompleted,
}: ToggleUserAdminDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
        await mutate({
          operation: "user-sysadmin",
          parameters: { id: user.user_id },
          method: "PUT",
          payload: {
            sysadmin_flag: !currentlyAdmin,
          },
        });
        onCompleted("用户系统权限已更新");
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
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

type UserPasswordDialogProps = {
  user: HarborUser;
  onClose: () => void;
  onCompleted: (message: string) => void;
};

function UserPasswordDialog({
  user,
  onClose,
  onCompleted,
}: UserPasswordDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
          throw new UserInputError(t("两次输入的密码不一致"));
        }
        await mutate({
          operation: "user-password",
          parameters: { id: user.user_id },
          method: "PUT",
          payload: {
            new_password: password,
          },
        });
        onCompleted("用户密码已更新");
      }}
    >
      <div className={resolveClasses("form-grid")}>
        <label className={resolveClasses("field")}>
          <span>{t("新密码")}</span>
          <FormInput
            name="new_password"
            type="password"
            required
            minLength={8}
            maxLength={4096}
            autoComplete="new-password"
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("再次输入")}</span>
          <FormInput
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

type UserGroupDialogProps = {
  group?: HarborUserGroup;
  onClose: () => void;
  onCompleted: (message: string) => void;
};

function UserGroupDialog({
  group,
  onClose,
  onCompleted,
}: UserGroupDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
        await mutate({
          operation: group ? "user-group" : "user-groups",
          parameters: group ? { id: group.id } : {},
          method: group ? "PUT" : "POST",
          payload: payload,
        });
        onCompleted(group ? "用户组已更新" : "用户组已创建");
      }}
    >
      <div className={resolveClasses("form-grid")}>
        <label className={resolveClasses("field")}>
          <span>{t("用户组名称")}</span>
          <FormInput
            name="group_name"
            required
            maxLength={255}
            defaultValue={group?.group_name ?? ""}
          />
        </label>
        <label className={resolveClasses("field")}>
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
        <label className={resolveClasses("field")}>
          <span>{t("LDAP 组 DN")}</span>
          <FormInput
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

type LabelDialogProps = {
  label?: ProjectLabel;
  onClose: () => void;
  onCompleted: (message: string) => void;
};

function LabelDialog({ label, onClose, onCompleted }: LabelDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
        await mutate({
          operation: label ? "label" : "labels",
          parameters: label ? { id: label.id } : {},
          method: label ? "PUT" : "POST",
          payload: payload,
        });
        onCompleted(label ? "全局标签已更新" : "全局标签已创建");
      }}
    >
      <div className={resolveClasses("form-grid")}>
        <label className={resolveClasses("field")}>
          <span>{t("标签名称")}</span>
          <FormInput
            name="name"
            required
            maxLength={128}
            defaultValue={label?.name ?? ""}
          />
        </label>
        <div
          className={resolveClasses(`field ${styles.globalLabelColorField}`)}
        >
          <span>{t("标签颜色")}</span>
          <div
            className={resolveClasses(styles.globalLabelPalette)}
            role="group"
            aria-label={t("标签预设颜色")}
          >
            {colorPresets.map(([value, name]) => (
              <button
                key={value}
                type="button"
                className={resolveClasses(styles.globalLabelColorSwatch)}
                title={t(name)}
                aria-label={`${t("选择")}${t(name)} ${value}`}
                aria-pressed={value === color}
                onClick={() => {
                  setColor(value);
                }}
              >
                <svg
                  className={resolveClasses(styles.globalLabelPresetFill)}
                  viewBox="0 0 30 30"
                  aria-hidden="true"
                  focusable="false"
                >
                  <rect width="30" height="30" fill={value} />
                </svg>
                <span className={resolveClasses(styles.globalLabelPresetCheck)}>
                  {value === color ? <Icon name="check" /> : null}
                </span>
              </button>
            ))}
          </div>
          <div className={resolveClasses(styles.globalLabelCustomColor)}>
            <FormInput
              type="color"
              value={color}
              aria-label={t("自定义标签颜色")}
              onChange={(event) => {
                setColor(event.currentTarget.value);
              }}
            />
            <span>{t("自定义颜色")}</span>
            <code>{color.toUpperCase()}</code>
          </div>
        </div>
        <label className={resolveClasses("field")}>
          <span>{t("描述")}</span>
          <FormTextarea
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

type QuotaDialogProps = {
  quota: ProjectQuota;
  onClose: () => void;
  onCompleted: (message: string) => void;
};

function QuotaDialog({ quota, onClose, onCompleted }: QuotaDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const hard = quota.hard?.storage ?? 0;
  const initial = hard < 0 ? -1 : Math.round((hard / 1024 ** 3) * 100) / 100;
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
        await mutate({
          operation: "quota",
          parameters: { id: quota.id },
          method: "PUT",
          payload: {
            hard: { storage },
          },
        });
        const persisted = await controlApi.data<ProjectQuota>("quota", {
          id: quota.id,
        });
        if (persisted?.hard?.storage !== storage) {
          throw new UserInputError(t("Harbor 未持久化项目配额，请刷新后重试"));
        }
        onCompleted("项目配额已更新");
      }}
    >
      <div className={resolveClasses("form-grid")}>
        <label className={resolveClasses("field")}>
          <span>{t("存储上限（GB）")}</span>
          <FormInput
            name="storage"
            type="number"
            min={-1}
            step={0.1}
            required
            defaultValue={initial}
          />
        </label>
        <p className={resolveClasses("field-help")}>
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

type SystemRobotDialogProps = {
  robot?: SystemRobot;
  permissionMetadata: PermissionMetadata;
  projects: ProjectSummary[];
  onClose: () => void;
  onCredential: (credential: RobotCredential) => void;
  onCompleted: (message: string) => void;
};

function SystemRobotDialog({
  robot,
  permissionMetadata,
  projects,
  onClose,
  onCredential,
  onCompleted,
}: SystemRobotDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
    (() => {
      if (allProjectPermission) {
        return "all";
      }
      if (initialSelectedProjects.size) {
        return "selected";
      }
      return "none";
    })(),
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
      dialogClass={resolveClasses("control-dialog-wide")}
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
            throw new UserInputError(
              t("请选择至少一个项目，或改为不授予项目权限"),
            );
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
          throw new UserInputError(t("请至少授予一项系统权限或项目权限"));
        const payload: RobotMutationPayload = {
          name: robot?.name ?? name.trim(),
          description: description.trim(),
          level: "system",
          duration: forever ? -1 : duration,
          disable: disabled,
          permissions,
        };
        if (robot) {
          await mutate({
            operation: "robot",
            parameters: { id: robot.id },
            method: "PUT",
            payload: robotUpdatePayload(payload),
          });
          onCompleted("系统机器人已更新");
          return;
        }
        const credential = await createRobotAccount(
          payload,
          {
            missingId: t("Harbor 未返回机器人编号，无法停用新账号"),
            missingSecret: t("Harbor 未返回机器人密钥"),
          },
          mutate,
        );
        onCredential(credential);
      }}
    >
      <div className={resolveClasses("form-grid two-columns")}>
        <label className={resolveClasses("field")}>
          <span>{t("账号名称")}</span>
          <FormInput
            required
            maxLength={255}
            value={name}
            disabled={Boolean(robot)}
            autoComplete="off"
            placeholder={t("例如 global-mirror")}
            onChange={(event) => {
              setName(event.currentTarget.value);
            }}
          />
        </label>
        <div className={resolveClasses("robot-duration-control")}>
          <label className={resolveClasses("field")}>
            <span>{t("有效期（天）")}</span>
            <FormInput
              type="number"
              min={1}
              required={!forever}
              disabled={forever}
              value={duration}
              onChange={(event) => {
                setDuration(
                  Math.max(1, Number(event.currentTarget.value) || 1),
                );
              }}
            />
          </label>
          <label className={resolveClasses("robot-duration-forever")}>
            <FormInput
              type="checkbox"
              checked={forever}
              onChange={(event) => {
                setForever(event.currentTarget.checked);
              }}
            />
            <span>{t("永不过期")}</span>
          </label>
          <small className={resolveClasses("field-help")}>
            {t("勾选后自动向 Harbor 提交 -1；0 不是有效值。")}
          </small>
        </div>
        <label className={resolveClasses("field field-span")}>
          <span>{t("描述")}</span>
          <FormInput
            maxLength={1024}
            value={description}
            onChange={(event) => {
              setDescription(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("check-row field-span")}>
          <FormInput
            type="checkbox"
            checked={disabled}
            onChange={(event) => {
              setDisabled(event.currentTarget.checked);
            }}
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
      <section className={resolveClasses(styles.robotProjectScope)}>
        <div className={resolveClasses("section-heading compact-heading")}>
          <div>
            <h3>{t("项目权限")}</h3>
            <p>{t("可不授予、覆盖全部项目，或分别配置指定项目。")}</p>
          </div>
          <label className={resolveClasses(`field ${styles.scopeSelect}`)}>
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
        {(() => {
          if (projectScope === "all") {
            return (
              <RobotPermissionMatrix
                candidates={projectCandidates}
                selected={allProjectKeys}
                legend="全部项目权限"
                compact
                onChange={setAllProjectKeys}
              />
            );
          }
          if (projectScope === "selected") {
            if (projects.length) {
              return (
                <div className={resolveClasses(styles.systemProjectEditor)}>
                  <div className={resolveClasses(styles.systemProjectList)}>
                    {projects.map((project) => {
                      const selected = selectedProjects.has(project.name);
                      const active = activeProject === project.name;
                      return (
                        <article
                          className={resolveClasses(
                            `${styles.systemProjectPermission}${active ? " active" : ""}`,
                          )}
                          key={project.name}
                        >
                          <label
                            className={resolveClasses(
                              styles.systemProjectChoice,
                            )}
                          >
                            <FormInput
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
                                    setActiveProject(
                                      next.values().next().value,
                                    );
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
                            className={resolveClasses("icon-button")}
                            type="button"
                            disabled={!selected}
                            title={`${t("配置")} ${project.name} ${t("权限")}`}
                            aria-label={`${t("配置")} ${project.name} ${t("权限")}`}
                            onClick={() => {
                              setActiveProject(project.name);
                            }}
                          >
                            <Icon name="settings" />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                  <div className={resolveClasses(styles.systemProjectDetails)}>
                    {activeProject && selectedProjects.has(activeProject) ? (
                      <RobotPermissionMatrix
                        candidates={projectCandidates}
                        selected={activeKeys}
                        legend={`${activeProject} 的权限`}
                        compact
                        onChange={(keys) => {
                          setProjectKeys((current) =>
                            new Map(current).set(activeProject, keys),
                          );
                        }}
                      />
                    ) : (
                      <div
                        className={resolveClasses(styles.systemProjectEmpty)}
                      >
                        <Icon name="folder" />
                        <strong>{t("选择一个项目")}</strong>
                        <span>
                          {t("勾选项目后，在这里配置它的 Harbor 权限。")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div className={resolveClasses("notice notice-warning")}>
                <Icon name="alert" />
                <span>{t("当前账号看不到可授权的项目。")}</span>
              </div>
            );
          }
          return null;
        })()}
      </section>
    </ControlDialog>
  );
}

type AdministrationDialogProps = {
  action: AdministrationAction;
  authMode: string;
  permissionMetadata: PermissionMetadata;
  projects: ProjectSummary[];
  onClose: () => void;
  onCompleted: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function AdministrationDialog({
  action,
  authMode,
  permissionMetadata,
  projects,
  onClose,
  onCompleted,
  onNotice,
}: AdministrationDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const [credential, setCredential] = useState<RobotCredential>();

  if (credential) {
    return (
      <RobotCredentialDialog
        credential={credential}
        onClose={() => {
          onCompleted(
            action.kind === "create-robot"
              ? "系统机器人已创建"
              : "机器人密钥已重置",
          );
        }}
        onCopied={(error) => {
          onNotice(error ? "复制失败" : "已复制到剪贴板", error);
        }}
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
          await mutate({
            operation: "user",
            parameters: { id: action.user.user_id },
            method: "DELETE",
          });
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
          await mutate({
            operation: "user-group",
            parameters: { id: action.group.id },
            method: "DELETE",
          });
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
          const response = await mutate<Pick<RobotCredential, "secret"> | null>(
            {
              operation: "robot",
              parameters: { id: action.robot.id },
              method: "PATCH",
              payload: { secret: "" },
            },
          );
          if (!response?.secret)
            throw new UserInputError(t("Harbor 未返回机器人密钥"));
          setCredential({
            name: action.robot.name,
            secret: response.secret,
          });
        }}
      >
        <div className={resolveClasses("notice notice-danger")}>
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
          await mutate({
            operation: "robot",
            parameters: { id: action.robot.id },
            method: "DELETE",
          });
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
          await mutate({
            operation: "label",
            parameters: { id: action.label.id },
            method: "DELETE",
          });
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

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  "unified-select": uiStyles0.unifiedSelect,
  notice: uiStyles0.notice,
  "notice-danger": uiStyles0.noticeDanger,
  field: uiStyles0.field,
  "form-grid": uiStyles0.formGrid,
  "two-columns": uiStyles0.twoColumns,
  "field-span": uiStyles0.fieldSpan,
  "control-dialog-large": uiStyles0.controlDialogLarge,
  "directory-search": uiStyles0.directorySearch,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "directory-results": uiStyles0.directoryResults,
  "dialog-loading": uiStyles0.dialogLoading,
  spinner: uiStyles0.spinner,
  "directory-state": uiStyles0.directoryState,
  "directory-state-error": uiStyles0.directoryStateError,
  "directory-result-head": uiStyles0.directoryResultHead,
  "directory-selection-list": uiStyles0.directorySelectionList,
  "directory-selection-row": uiStyles0.directorySelectionRow,
  "user-avatar-small": uiStyles0.userAvatarSmall,
  "cell-stack": uiStyles0.cellStack,
  "field-help": uiStyles0.fieldHelp,
  selected: uiStyles0.selected,
  "control-dialog-wide": uiStyles0.controlDialogWide,
  "robot-duration-control": uiStyles0.robotDurationControl,
  "robot-duration-forever": uiStyles0.robotDurationForever,
  "check-row": uiStyles0.checkRow,
  "section-heading": uiStyles0.sectionHeading,
  "compact-heading": uiStyles0.compactHeading,
  active: uiStyles0.active,
  "icon-button": uiStyles0.iconButton,
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
});

function useLdapImportData({ term }: { term: string }) {
  return useLoadedQuery(
    administrationKeys.ldapUsers(term),
    (signal) =>
      controlApi
        .list<HarborDirectoryUser>(
          "ldap-users-search",
          { username: term },
          signal,
        )
        .then((result) => result.items),
    { keepPrevious: false },
  );
}
