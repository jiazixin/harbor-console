import { RobotCredentialDialog } from "../components/robot-credential-dialog";
import { AddProjectMemberDialog } from "../features/projects/add-project-member-dialog";
import { CreateProjectDialog } from "../features/projects/create-project-dialog";
import { DeleteProjectDialog } from "../features/projects/delete-project-dialog";
import { DeleteProjectMemberDialog } from "../features/projects/delete-project-member-dialog";
import { DeleteProjectRobotDialog } from "../features/projects/delete-project-robot-dialog";
import { DeleteProjectsDialog } from "../features/projects/delete-projects-dialog";
import { EditProjectMemberDialog } from "../features/projects/edit-project-member-dialog";
import { ProjectCveExportDialog } from "../features/projects/project-cve-export-dialog";
import { ProjectRobotDialog } from "../features/projects/project-robot-dialog";
import { ResetRobotSecretDialog } from "../features/projects/reset-robot-secret-dialog";
import {
  type ApplicationDialog,
  clipboardMessage,
  type DialogControls,
} from "./application-dialogs";

/** Project lifecycle, member and robot account dialogs. */
type ProjectDialogRouteProps = {
  dialog: ApplicationDialog;
  controls: DialogControls;
};

export function ProjectDialogRoute({
  dialog,
  controls,
}: ProjectDialogRouteProps) {
  const { authMode, close, complete, notify, open, route } = controls;
  const changedProject = { reload: "project", refreshConsole: true } as const;

  switch (dialog.kind) {
    case "create":
      return (
        <CreateProjectDialog
          onClose={close}
          onCreated={(name) => {
            complete(`项目 ${name} 已创建`, {
              navigateTo: `projects/${encodeURIComponent(name)}`,
            });
          }}
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
          onDeleted={() => {
            complete(`项目 ${dialog.project.name} 已删除`, {
              navigateTo: "projects",
              refreshConsole: true,
            });
          }}
        />
      );
    case "export":
      return (
        <ProjectCveExportDialog
          project={dialog.project}
          onClose={close}
          onCreated={(id) => {
            complete(`CVE 导出任务 #${String(id ?? "-")} 已创建`);
          }}
        />
      );
    case "add-member":
      return (
        <AddProjectMemberDialog
          project={dialog.project}
          existingMembers={dialog.members}
          authMode={authMode}
          onClose={close}
          onCreated={() => {
            complete("项目成员已添加", changedProject);
          }}
        />
      );
    case "edit-member":
      return (
        <EditProjectMemberDialog
          project={dialog.project}
          member={dialog.member}
          onClose={close}
          onUpdated={() => {
            complete("成员角色已更新", changedProject);
          }}
        />
      );
    case "delete-member":
      return (
        <DeleteProjectMemberDialog
          project={dialog.project}
          member={dialog.member}
          onClose={close}
          onDeleted={() => {
            complete("项目成员已删除", changedProject);
          }}
        />
      );
    case "create-robot":
      return (
        <ProjectRobotDialog
          project={dialog.project}
          permissionCandidates={dialog.permissions}
          onClose={close}
          onCreated={(credential) => {
            open({ kind: "robot-credential", credential, source: "create" });
          }}
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
          onUpdated={() => {
            complete("机器人账号已更新", { reload: "project" });
          }}
        />
      );
    case "reset-robot":
      return (
        <ResetRobotSecretDialog
          robot={dialog.robot}
          onClose={close}
          onReset={(credential) => {
            open({ kind: "robot-credential", credential, source: "reset" });
          }}
        />
      );
    case "delete-robot":
      return (
        <DeleteProjectRobotDialog
          project={dialog.project}
          robot={dialog.robot}
          onClose={close}
          onDeleted={() => {
            complete("机器人账号已删除", { reload: "project" });
          }}
        />
      );
    case "robot-credential":
      return (
        <RobotCredentialDialog
          credential={dialog.credential}
          onClose={() => {
            complete(
              dialog.source === "reset"
                ? "机器人密钥已重置"
                : "机器人账号已创建",
              { reload: "project" },
            );
          }}
          onCopied={(copyFailed) => {
            notify(clipboardMessage(copyFailed), copyFailed);
          }}
        />
      );
    default:
      return null;
  }
}
