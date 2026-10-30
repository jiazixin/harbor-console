import { useState } from "react";
import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { ProjectMember } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { formatNumber } from "../../lib/format/formatters";
import { useMemberDirectoryData } from "./use-member-directory-data";

import { useControlMutation } from "../../app/use-control-mutation";
import {
  affectedQueries,
  formString,
  projectRoles,
} from "./project-member-dialogs-support";
import styles from "./projects.module.css";

type MemberType = "group" | "user";

function groupTypeLabel(value: number | undefined): string {
  return { 1: "LDAP", 2: "HTTP", 3: "OIDC" }[value ?? 0] ?? "未知";
}

function firstNonEmpty(...values: (string | undefined)[]): string {
  return values.find((value) => value?.trim()) ?? "-";
}

type DirectoryStateProps = {
  icon?: "alert" | "search" | "users";
  title: string;
  message: string;
  compact?: boolean;
  error?: boolean;
};

function DirectoryState({
  icon = "search",
  title,
  message,
  compact = false,
  error = false,
}: DirectoryStateProps) {
  const { t } = useLocale();
  return (
    <div
      className={resolveClasses(
        `directory-state${compact ? " compact" : ""}${error ? " directory-state-error" : ""}`,
      )}
    >
      <Icon name={icon} />
      <div>
        <strong>{t(title)}</strong>
        <span>{t(message)}</span>
      </div>
    </div>
  );
}

type AddProjectMemberDialogProps = {
  project: string;
  existingMembers: ProjectMember[];
  authMode: string;
  onClose: () => void;
  onCreated: () => void;
};

export function AddProjectMemberDialog({
  project,
  existingMembers,
  authMode,
  onClose,
  onCreated,
}: AddProjectMemberDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const [memberType, setMemberType] = useState<MemberType>("user");
  const [userQuery, setUserQuery] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [roleId, setRoleId] = useState("2");
  const directory = useMemberDirectoryData({
    type: memberType,
    query: memberType === "user" ? userQuery : groupQuery,
    authMode,
  });
  const alreadyExists = (name: string) =>
    existingMembers.some(
      (member) =>
        member.entity_name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
  const users = directory.users.filter(
    (user) => user.username && !alreadyExists(user.username),
  );
  const groups = directory.groups.filter(
    (group) => !alreadyExists(group.group_name ?? group.ldap_group_dn ?? ""),
  );
  const userStatus = directory.status;
  const groupStatus = directory.status;
  const userError = directory.error;
  const groupError = directory.error;
  const searchDirectory = directory.search;

  return (
    <ControlDialog
      title="添加项目成员"
      subtitle={project}
      submitLabel="添加成员"
      dialogClass={resolveClasses("control-dialog-large")}
      onClose={onClose}
      onSubmit={async (formData) => {
        const selectedRoleId = Number(formString(formData, "role_id"));
        if (memberType === "group") {
          const index = Number(formString(formData, "member_group_index"));
          const group = groups.at(index);
          if (!group) throw new UserInputError(t("请选择一个用户组"));
          await mutate({
            operation: "project-members",
            parameters: { project },
            method: "POST",
            payload: {
              role_id: selectedRoleId,
              member_group: {
                group_name: group.group_name ?? "",
                group_type: group.group_type ?? 1,
                ldap_group_dn: group.ldap_group_dn ?? "",
              },
            },
          });
        } else {
          const index = Number(formString(formData, "member_user_index"));
          const user = users.at(index);
          if (!user) throw new UserInputError(t("请选择一个 Harbor 用户"));
          await mutate({
            operation: "project-members",
            parameters: { project },
            method: "POST",
            payload: {
              role_id: selectedRoleId,
              member_user: { username: user.username.trim() },
            },
          });
        }
        onCreated();
      }}
    >
      <div
        className={resolveClasses(styles.memberTypeSwitch)}
        role="group"
        aria-label={t("成员类型")}
      >
        <label>
          <FormInput
            name="member_type"
            type="radio"
            value="user"
            checked={memberType === "user"}
            onChange={() => {
              setMemberType("user");
            }}
          />
          <span>
            <Icon name="users" />
            <b>{t("Harbor 用户")}</b>
            <small>{t("从目录搜索并选择用户账号")}</small>
          </span>
        </label>
        <label>
          <FormInput
            name="member_type"
            type="radio"
            value="group"
            checked={memberType === "group"}
            onChange={() => {
              setMemberType("group");
            }}
          />
          <span>
            <Icon name="users" />
            <b>{t("用户组")}</b>
            <small>{t("从身份目录选择用户组")}</small>
          </span>
        </label>
      </div>
      <div
        className={resolveClasses(styles.memberDirectoryPanel)}
        hidden={memberType !== "user"}
      >
        <div className={resolveClasses("directory-search")}>
          <label className={resolveClasses("field")}>
            <span>{t("Harbor 用户名")}</span>
            <FormInput
              type="search"
              maxLength={255}
              autoComplete="off"
              value={userQuery}
              placeholder={t("搜索用户")}
              onChange={(event) => {
                setUserQuery(event.currentTarget.value);
              }}
            />
          </label>
          <button
            className={resolveClasses("button button-small")}
            type="button"
            onClick={() => void searchDirectory()}
          >
            <Icon name="search" />
            <span>{t("搜索目录")}</span>
          </button>
        </div>
        <div className={resolveClasses("directory-results")}>
          {userStatus === "idle" ? (
            <DirectoryState
              compact
              title="搜索可用用户"
              message="结果来自 Harbor 官方目录接口。"
            />
          ) : null}
          {userStatus === "loading" ? (
            <div className={resolveClasses("dialog-loading")}>
              <span className={resolveClasses("spinner")} />
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
              <div className={resolveClasses("directory-result-head")}>
                <span>{t("可用用户")}</span>
                <span>
                  {formatNumber(users.length, locale)} {t("个结果")}
                </span>
              </div>
              <div className={resolveClasses("directory-selection-list")}>
                {users.map((user, index) => (
                  <label
                    className={resolveClasses("directory-selection-row")}
                    key={user.username}
                  >
                    <FormInput
                      name="member_user_index"
                      type="radio"
                      value={index}
                    />
                    <span
                      className={resolveClasses("user-avatar-small")}
                      aria-hidden="true"
                    >
                      {user.username.slice(0, 1).toUpperCase()}
                    </span>
                    <span className={resolveClasses("cell-stack")}>
                      <strong>{user.username}</strong>
                      {user.realname?.trim() || user.email?.trim() ? (
                        <small>
                          {firstNonEmpty(user.realname, user.email)}
                        </small>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div
        className={resolveClasses(styles.memberDirectoryPanel)}
        hidden={memberType !== "group"}
      >
        <div className={resolveClasses("directory-search")}>
          <label className={resolveClasses("field")}>
            <span>{t("用户组名称")}</span>
            <FormInput
              type="search"
              maxLength={255}
              autoComplete="off"
              value={groupQuery}
              placeholder={t("搜索用户组")}
              onChange={(event) => {
                setGroupQuery(event.currentTarget.value);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void searchDirectory();
              }}
            />
          </label>
          <button
            className={resolveClasses("button button-small")}
            type="button"
            onClick={() => void searchDirectory()}
          >
            <Icon name="search" />
            <span>{t("搜索目录")}</span>
          </button>
        </div>
        <div className={resolveClasses("directory-results")}>
          {groupStatus === "idle" ? (
            <DirectoryState
              compact
              title="搜索可用用户组"
              message="结果来自 Harbor 官方目录接口。"
            />
          ) : null}
          {groupStatus === "loading" ? (
            <div className={resolveClasses("dialog-loading")}>
              <span className={resolveClasses("spinner")} />
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
              <div className={resolveClasses("directory-result-head")}>
                <span>{t("可用用户组")}</span>
                <span>
                  {formatNumber(groups.length, locale)} {t("个结果")}
                </span>
              </div>
              <div className={resolveClasses("directory-selection-list")}>
                {groups.map((group, index) => (
                  <label
                    className={resolveClasses("directory-selection-row")}
                    key={group.id ?? group.group_name ?? group.ldap_group_dn}
                  >
                    <FormInput
                      name="member_group_index"
                      type="radio"
                      value={index}
                    />
                    <span
                      className={resolveClasses("user-avatar-small")}
                      aria-hidden="true"
                    >
                      <Icon name="users" />
                    </span>
                    <span className={resolveClasses("cell-stack")}>
                      <strong>
                        {firstNonEmpty(group.group_name, group.ldap_group_dn)}
                      </strong>
                      <small className={resolveClasses("mono")}>
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
      <label className={resolveClasses(`field ${styles.memberRoleField}`)}>
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

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  "unified-select": uiStyles0.unifiedSelect,
  "directory-state": uiStyles0.directoryState,
  compact: uiStyles0.compact,
  "directory-state-error": uiStyles0.directoryStateError,
  "control-dialog-large": uiStyles0.controlDialogLarge,
  "directory-search": uiStyles0.directorySearch,
  field: uiStyles0.field,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "directory-results": uiStyles0.directoryResults,
  "dialog-loading": uiStyles0.dialogLoading,
  spinner: uiStyles0.spinner,
  "directory-result-head": uiStyles0.directoryResultHead,
  "directory-selection-list": uiStyles0.directorySelectionList,
  "directory-selection-row": uiStyles0.directorySelectionRow,
  "user-avatar-small": uiStyles0.userAvatarSmall,
  "cell-stack": uiStyles0.cellStack,
  mono: uiStyles0.mono,
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
