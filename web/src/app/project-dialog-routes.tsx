import { RobotCredentialDialog } from "../components/robot-credential-dialog";
import {
  CreateProjectDialog,
  DeleteProjectDialog,
  DeleteProjectsDialog,
  ProjectCveExportDialog,
} from "../features/projects/project-dialogs";
import {
  AddProjectMemberDialog,
  DeleteProjectMemberDialog,
  EditProjectMemberDialog,
} from "../features/projects/project-member-dialogs";
import { PreheatDialogHost } from "../features/projects/project-preheat-dialog-host";
import { RetentionDialogHost } from "../features/projects/project-retention-dialog-host";
import {
  DeleteProjectRobotDialog,
  ProjectRobotDialog,
  ResetRobotSecretDialog,
} from "../features/projects/project-robot-dialogs";
import {
  DeleteImmutableTagRuleDialog,
  DeleteProjectLabelDialog,
  ImmutableTagRuleDialog,
  ProjectLabelDialog,
} from "../features/projects/project-rule-dialogs";
import {
  DeleteProjectWebhookDialog,
  ProjectWebhookDialog,
} from "../features/projects/project-webhook-dialogs";
import { WebhookHistoryDialog } from "../features/projects/project-webhook-history";
import {
  type ApplicationDialog,
  clipboardMessage,
  type DialogControls,
} from "./application-dialogs";

/** Project lifecycle, member and robot account dialogs. */
export function ProjectDialogRoute({
  dialog,
  controls,
}: {
  dialog: ApplicationDialog;
  controls: DialogControls;
}) {
  const { authMode, close, complete, notify, open, route } = controls;
  const changedProject = { reload: "project", refreshConsole: true } as const;

  switch (dialog.kind) {
    case "create":
      return (
        <CreateProjectDialog
          onClose={close}
          onCreated={(name) =>
            complete(`项目 ${name} 已创建`, {
              navigateTo: `projects/${encodeURIComponent(name)}`,
            })
          }
        />
      );
    case "delete":
      return (
        <DeleteProjectsDialog
          projects={dialog.projects}
          onClose={close}
          onDeleted={(failures) => {
            const total = dialog.projects.length;
            // Deleting the project that is open leaves its page empty.
            const leaveProjectPage =
              !failures && total === 1 && route.view === "project";
            complete(
              failures
                ? `项目删除完成，${String(failures)} 项失败`
                : `${String(total)} 个项目已删除`,
              {
                error: failures > 0,
                refreshConsole: true,
                navigateTo: leaveProjectPage ? "projects" : undefined,
              },
            );
          }}
        />
      );
    case "delete-project":
      return (
        <DeleteProjectDialog
          project={dialog.project}
          onClose={close}
          onDeleted={() =>
            complete(`项目 ${dialog.project.name} 已删除`, {
              navigateTo: "projects",
              refreshConsole: true,
            })
          }
        />
      );
    case "export":
      return (
        <ProjectCveExportDialog
          project={dialog.project}
          onClose={close}
          onCreated={(id) =>
            complete(`CVE 导出任务 #${String(id ?? "-")} 已创建`)
          }
        />
      );
    case "add-member":
      return (
        <AddProjectMemberDialog
          project={dialog.project}
          existingMembers={dialog.members}
          authMode={authMode}
          onClose={close}
          onCreated={() => complete("项目成员已添加", changedProject)}
        />
      );
    case "edit-member":
      return (
        <EditProjectMemberDialog
          project={dialog.project}
          member={dialog.member}
          onClose={close}
          onUpdated={() => complete("成员角色已更新", changedProject)}
        />
      );
    case "delete-member":
      return (
        <DeleteProjectMemberDialog
          project={dialog.project}
          member={dialog.member}
          onClose={close}
          onDeleted={() => complete("项目成员已删除", changedProject)}
        />
      );
    case "create-robot":
      return (
        <ProjectRobotDialog
          project={dialog.project}
          permissionCandidates={dialog.permissions}
          onClose={close}
          onCreated={(credential) =>
            open({ kind: "robot-credential", credential, source: "create" })
          }
          onUpdated={() => undefined}
        />
      );
    case "edit-robot":
      return (
        <ProjectRobotDialog
          project={dialog.project}
          robot={dialog.robot}
          permissionCandidates={dialog.permissions}
          onClose={close}
          onCreated={() => undefined}
          onUpdated={() => complete("机器人账号已更新", { reload: "project" })}
        />
      );
    case "reset-robot":
      return (
        <ResetRobotSecretDialog
          robot={dialog.robot}
          onClose={close}
          onReset={(credential) =>
            open({ kind: "robot-credential", credential, source: "reset" })
          }
        />
      );
    case "delete-robot":
      return (
        <DeleteProjectRobotDialog
          project={dialog.project}
          robot={dialog.robot}
          onClose={close}
          onDeleted={() => complete("机器人账号已删除", { reload: "project" })}
        />
      );
    case "robot-credential":
      return (
        <RobotCredentialDialog
          credential={dialog.credential}
          onClose={() =>
            complete(
              dialog.source === "reset"
                ? "机器人密钥已重置"
                : "机器人账号已创建",
              { reload: "project" },
            )
          }
          onCopied={(copyFailed) =>
            notify(clipboardMessage(copyFailed), copyFailed)
          }
        />
      );
    default:
      return null;
  }
}

/** Project webhook, immutability, label, retention and preheat dialogs. */
export function ProjectPolicyDialogRoute({
  dialog,
  controls,
}: {
  dialog: ApplicationDialog;
  controls: DialogControls;
}) {
  const { close, complete, notify } = controls;
  const changedProject = { reload: "project" } as const;

  switch (dialog.kind) {
    case "create-webhook":
      return (
        <ProjectWebhookDialog
          project={dialog.project}
          metadata={dialog.metadata}
          onClose={close}
          onSaved={() => complete("Webhook 已创建", changedProject)}
        />
      );
    case "edit-webhook":
      return (
        <ProjectWebhookDialog
          project={dialog.project}
          webhook={dialog.webhook}
          metadata={dialog.metadata}
          onClose={close}
          onSaved={() => complete("Webhook 已更新", changedProject)}
        />
      );
    case "webhook-history":
      return (
        <WebhookHistoryDialog
          project={dialog.project}
          webhook={dialog.webhook}
          onClose={close}
          onNotice={notify}
        />
      );
    case "delete-webhook":
      return (
        <DeleteProjectWebhookDialog
          project={dialog.project}
          webhook={dialog.webhook}
          onClose={close}
          onDeleted={() => complete("Webhook 已删除", changedProject)}
        />
      );
    case "create-immutable-rule":
      return (
        <ImmutableTagRuleDialog
          project={dialog.project}
          metadata={dialog.metadata}
          onClose={close}
          onSaved={() => complete("不可变规则已创建", changedProject)}
        />
      );
    case "edit-immutable-rule":
      return (
        <ImmutableTagRuleDialog
          project={dialog.project}
          rule={dialog.rule}
          metadata={dialog.metadata}
          onClose={close}
          onSaved={() => complete("不可变规则已更新", changedProject)}
        />
      );
    case "delete-immutable-rule":
      return (
        <DeleteImmutableTagRuleDialog
          project={dialog.project}
          rule={dialog.rule}
          onClose={close}
          onDeleted={() => complete("不可变规则已删除", changedProject)}
        />
      );
    case "create-project-label":
      return (
        <ProjectLabelDialog
          project={dialog.project}
          projectId={dialog.projectId}
          onClose={close}
          onSaved={() => complete("项目标签已创建", changedProject)}
        />
      );
    case "edit-project-label":
      return (
        <ProjectLabelDialog
          project={dialog.project}
          projectId={dialog.projectId}
          label={dialog.label}
          onClose={close}
          onSaved={() => complete("项目标签已更新", changedProject)}
        />
      );
    case "delete-project-label":
      return (
        <DeleteProjectLabelDialog
          label={dialog.label}
          onClose={close}
          onDeleted={() => complete("项目标签已删除", changedProject)}
        />
      );
    case "retention":
      return (
        <RetentionDialogHost
          action={dialog.action}
          onClose={close}
          onChanged={(message) => complete(message, changedProject)}
          onNotice={notify}
        />
      );
    case "preheat":
      return (
        <PreheatDialogHost
          action={dialog.action}
          onClose={close}
          onChanged={(message) => complete(message, changedProject)}
          onNotice={notify}
        />
      );
    default:
      return null;
  }
}
