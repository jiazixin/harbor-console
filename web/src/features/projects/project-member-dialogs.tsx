import { useCallback, useEffect, useRef, useState } from "react";

import { controlApi } from "../../app/api-client";
import { formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  HarborDirectoryGroup,
  HarborDirectoryUser,
  ProjectMember,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import { UnifiedSelect } from "../../components/unified-select";

type DirectoryStatus = "idle" | "loading" | "ready" | "error";
type MemberType = "group" | "user";

const projectRoles = [
  { value: "1", label: "项目管理员" },
  { value: "4", label: "维护者" },
  { value: "2", label: "开发者" },
  { value: "3", label: "访客" },
];

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function groupTypeLabel(value: number | undefined): string {
  return { 1: "LDAP", 2: "HTTP", 3: "OIDC" }[value ?? 0] ?? "未知";
}

function firstNonEmpty(...values: (string | undefined)[]): string {
  return values.find((value) => value?.trim()) ?? "-";
}

function DirectoryState({
  icon = "search",
  title,
  message,
  compact = false,
  error = false,
}: {
  icon?: "alert" | "search" | "users";
  title: string;
  message: string;
  compact?: boolean;
  error?: boolean;
}) {
  const { t } = useLocale();
  return (
    <div
      className={`directory-state${compact ? " compact" : ""}${error ? " directory-state-error" : ""}`}
    >
      <Icon name={icon} />
      <div>
        <strong>{t(title)}</strong>
        <span>{t(message)}</span>
      </div>
    </div>
  );
}

export function AddProjectMemberDialog({
  project,
  existingMembers,
  authMode,
  onClose,
  onCreated,
}: {
  project: string;
  existingMembers: ProjectMember[];
  authMode: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { locale, t } = useLocale();
  const [memberType, setMemberType] = useState<MemberType>("user");
  const [userQuery, setUserQuery] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [users, setUsers] = useState<HarborDirectoryUser[]>([]);
  const [groups, setGroups] = useState<HarborDirectoryGroup[]>([]);
  const [userStatus, setUserStatus] = useState<DirectoryStatus>("idle");
  const [groupStatus, setGroupStatus] = useState<DirectoryStatus>("idle");
  const [userError, setUserError] = useState("");
  const [groupError, setGroupError] = useState("");
  const [roleId, setRoleId] = useState("2");
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const lastAutomaticSearch = useRef("");

  const alreadyExists = useCallback(
    (name: string) =>
      existingMembers.some(
        (member) =>
          member.entity_name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      ),
    [existingMembers],
  );

  const searchDirectory = useCallback(
    async (type: MemberType, rawTerm: string, force = false) => {
      const term = rawTerm.trim();
      if (!term) return;
      const searchKey = `${type}:${term}`;
      if (!force && lastAutomaticSearch.current === searchKey) return;
      lastAutomaticSearch.current = searchKey;
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      const sequence = ++requestSequence.current;
      if (type === "user") {
        setUserStatus("loading");
        setUserError("");
      } else {
        setGroupStatus("loading");
        setGroupError("");
      }
      try {
        if (type === "user") {
          const result = await controlApi.list<HarborDirectoryUser>(
            "users-search",
            { username: term, page: 1, page_size: 20 },
            controller.signal,
          );
          if (sequence !== requestSequence.current) return;
          setUsers(
            result.items.filter(
              (user) => user.username && !alreadyExists(user.username),
            ),
          );
          setUserStatus("ready");
          return;
        }
        const operation =
          authMode === "ldap_auth"
            ? "ldap-groups-search"
            : "user-groups-search";
        const parameters =
          operation === "ldap-groups-search"
            ? { groupname: term }
            : { groupname: term, page: 1, page_size: 20 };
        const result = await controlApi.list<HarborDirectoryGroup>(
          operation,
          parameters,
          controller.signal,
        );
        if (sequence !== requestSequence.current) return;
        setGroups(
          result.items.filter((group) => {
            const name = group.group_name ?? group.ldap_group_dn ?? "";
            return name && !alreadyExists(name);
          }),
        );
        setGroupStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        if (sequence !== requestSequence.current) return;
        const message = error instanceof Error ? error.message : String(error);
        if (type === "user") {
          setUserStatus("error");
          setUserError(message);
        } else {
          setGroupStatus("error");
          setGroupError(message);
        }
      }
    },
    [alreadyExists, authMode],
  );

  useEffect(() => {
    const query = memberType === "user" ? userQuery : groupQuery;
    if (!query.trim()) return;
    const timer = window.setTimeout(
      () => void searchDirectory(memberType, query),
      320,
    );
    return () => window.clearTimeout(timer);
  }, [groupQuery, memberType, searchDirectory, userQuery]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  return (
    <ControlDialog
      title="添加项目成员"
      subtitle={project}
      submitLabel="添加成员"
      dialogClass="control-dialog-large"
      onClose={onClose}
      onSubmit={async (formData) => {
        const selectedRoleId = Number(formString(formData, "role_id"));
        if (memberType === "group") {
          const index = Number(formString(formData, "member_group_index"));
          const group = groups.at(index);
          if (!group) throw new Error(t("请选择一个用户组"));
          await controlApi.mutate("project-members", { project }, "POST", {
            role_id: selectedRoleId,
            member_group: {
              group_name: group.group_name ?? "",
              group_type: group.group_type ?? 1,
              ldap_group_dn: group.ldap_group_dn ?? "",
            },
          });
        } else {
          const index = Number(formString(formData, "member_user_index"));
          const user = users.at(index);
          if (!user) throw new Error(t("请选择一个 Harbor 用户"));
          await controlApi.mutate("project-members", { project }, "POST", {
            role_id: selectedRoleId,
            member_user: { username: user.username.trim() },
          });
        }
        onCreated();
      }}
    >
      <div
        className="member-type-switch"
        role="group"
        aria-label={t("成员类型")}
      >
        <label>
          <input
            name="member_type"
            type="radio"
            value="user"
            checked={memberType === "user"}
            onChange={() => setMemberType("user")}
          />
          <span>
            <Icon name="users" />
            <b>{t("Harbor 用户")}</b>
            <small>{t("从目录搜索并选择用户账号")}</small>
          </span>
        </label>
        <label>
          <input
            name="member_type"
            type="radio"
            value="group"
            checked={memberType === "group"}
            onChange={() => setMemberType("group")}
          />
          <span>
            <Icon name="users" />
            <b>{t("用户组")}</b>
            <small>{t("从身份目录选择用户组")}</small>
          </span>
        </label>
      </div>
      <div className="member-directory-panel" hidden={memberType !== "user"}>
        <div className="directory-search">
          <label className="field">
            <span>{t("Harbor 用户名")}</span>
            <input
              type="search"
              maxLength={255}
              autoComplete="off"
              value={userQuery}
              placeholder={t("搜索用户")}
              onChange={(event) => setUserQuery(event.currentTarget.value)}
            />
          </label>
          <button
            className="button button-small"
            type="button"
            onClick={() => void searchDirectory("user", userQuery, true)}
          >
            <Icon name="search" />
            <span>{t("搜索目录")}</span>
          </button>
        </div>
        <div className="directory-results">
          {userStatus === "idle" ? (
            <DirectoryState
              compact
              title="搜索可用用户"
              message="结果来自 Harbor 官方目录接口。"
            />
          ) : null}
          {userStatus === "loading" ? (
            <div className="dialog-loading">
              <span className="spinner" />
              <span>{t("正在搜索用户...")}</span>
            </div>
          ) : null}
          {userStatus === "error" ? (
            <DirectoryState
              icon="alert"
              title="用户搜索失败"
              message={userError}
              error
            />
          ) : null}
          {userStatus === "ready" && !users.length ? (
            <DirectoryState
              icon="users"
              title="没有可添加的用户"
              message="调整名称，或该用户已经是项目成员。"
            />
          ) : null}
          {userStatus === "ready" && users.length ? (
            <>
              <div className="directory-result-head">
                <span>{t("可用用户")}</span>
                <span>
                  {formatNumber(users.length, locale)} {t("个结果")}
                </span>
              </div>
              <div className="directory-selection-list">
                {users.map((user, index) => (
                  <label
                    className="directory-selection-row"
                    key={user.username}
                  >
                    <input
                      name="member_user_index"
                      type="radio"
                      value={index}
                    />
                    <span className="cell-stack">
                      <strong>{user.username}</strong>
                      <small>{firstNonEmpty(user.realname, user.email)}</small>
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div className="member-directory-panel" hidden={memberType !== "group"}>
        <div className="directory-search">
          <label className="field">
            <span>{t("用户组名称")}</span>
            <input
              type="search"
              maxLength={255}
              autoComplete="off"
              value={groupQuery}
              placeholder={t("搜索用户组")}
              onChange={(event) => setGroupQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void searchDirectory("group", groupQuery, true);
              }}
            />
          </label>
          <button
            className="button button-small"
            type="button"
            onClick={() => void searchDirectory("group", groupQuery, true)}
          >
            <Icon name="search" />
            <span>{t("搜索目录")}</span>
          </button>
        </div>
        <div className="directory-results">
          {groupStatus === "idle" ? (
            <DirectoryState
              compact
              title="搜索可用用户组"
              message="结果来自 Harbor 官方目录接口。"
            />
          ) : null}
          {groupStatus === "loading" ? (
            <div className="dialog-loading">
              <span className="spinner" />
              <span>{t("正在搜索用户组...")}</span>
            </div>
          ) : null}
          {groupStatus === "error" ? (
            <DirectoryState
              icon="alert"
              title="用户组搜索失败"
              message={groupError}
              error
            />
          ) : null}
          {groupStatus === "ready" && !groups.length ? (
            <DirectoryState
              icon="users"
              title="没有匹配的用户组"
              message="调整名称后重新搜索。"
            />
          ) : null}
          {groupStatus === "ready" && groups.length ? (
            <>
              <div className="directory-result-head">
                <span>{t("可用用户组")}</span>
                <span>
                  {formatNumber(groups.length, locale)} {t("个结果")}
                </span>
              </div>
              <div className="directory-selection-list">
                {groups.map((group, index) => (
                  <label
                    className="directory-selection-row"
                    key={group.id ?? group.group_name ?? group.ldap_group_dn}
                  >
                    <input
                      name="member_group_index"
                      type="radio"
                      value={index}
                    />
                    <span className="cell-stack">
                      <strong>
                        {firstNonEmpty(group.group_name, group.ldap_group_dn)}
                      </strong>
                      <small className="mono">
                        {firstNonEmpty(
                          group.ldap_group_dn,
                          groupTypeLabel(group.group_type),
                        )}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
      <label className="field member-role-field">
        <span>{t("项目角色")}</span>
        <UnifiedSelect
          name="role_id"
          ariaLabel={t("项目角色")}
          value={roleId}
          options={projectRoles.map((role) => ({
            value: role.value,
            label: t(role.label),
          }))}
          onChange={setRoleId}
        />
      </label>
    </ControlDialog>
  );
}

export function EditProjectMemberDialog({
  project,
  member,
  onClose,
  onUpdated,
}: {
  project: string;
  member: ProjectMember;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { t } = useLocale();
  const [roleId, setRoleId] = useState(String(member.role_id ?? 2));
  return (
    <ControlDialog
      title="修改成员角色"
      subtitle={member.entity_name}
      submitLabel="保存角色"
      onClose={onClose}
      onSubmit={async (formData) => {
        await controlApi.mutate(
          "project-member",
          { project, member: member.id },
          "PUT",
          { role_id: Number(formString(formData, "role_id")) },
        );
        onUpdated();
      }}
    >
      <label className="field">
        <span>{t("项目角色")}</span>
        <UnifiedSelect
          name="role_id"
          ariaLabel={t("项目角色")}
          value={roleId}
          options={projectRoles.map((role) => ({
            value: role.value,
            label: t(role.label),
          }))}
          onChange={setRoleId}
        />
      </label>
    </ControlDialog>
  );
}

export function DeleteProjectMemberDialog({
  project,
  member,
  onClose,
  onDeleted,
}: {
  project: string;
  member: ProjectMember;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  const subtitle =
    locale === "en-US"
      ? `Remove ${member.entity_name} from project ${project}.`
      : `将从项目 ${project} 中移除 ${member.entity_name}。`;
  return (
    <ControlDialog
      title="删除项目成员"
      subtitle={subtitle}
      submitLabel="删除成员"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "project-member",
          { project, member: member.id },
          "DELETE",
        );
        onDeleted();
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
    </ControlDialog>
  );
}
