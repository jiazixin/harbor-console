import { ReplicationDialogHost } from "../features/replication/replication-dialog-host";
import { ArtifactDetailDialogHost } from "../features/artifacts/artifact-detail-dialog-host";
import { PreheatDialogHost } from "../features/projects/project-preheat-dialog-host";
import { RetentionDialogHost } from "../features/projects/project-retention-dialog-host";

import type {
  HarborPermission,
  ImmutableTagRule,
  ProjectLabel,
  ProjectMember,
  ProjectRobot,
  ProjectSummary,
  ProjectWebhook,
  RobotCredential,
  RepositorySummary,
  RetentionMetadata,
  Session,
  WebhookEventMetadata,
} from "./models";
import {
  ArtifactLabelDialog,
  CopyArtifactDialog,
  DeleteArtifactsDialog,
} from "../features/artifacts/artifact-dialogs";
import { type ArtifactDetailAction } from "../features/artifacts/artifact-detail-page";
import { type RepositoryArtifactAction } from "../features/artifacts/repository-detail-page";
import {
  DeleteRegistryDialog,
  RegistryDialog,
} from "../features/registries/registry-dialogs";
import { type RegistryAction } from "../features/registries/registries-page";
import { type ReplicationAction } from "../features/replication/replication-page";
import {
  DeletePreheatInstanceDialog,
  PreheatInstanceDialog,
} from "../features/preheat/preheat-dialogs";
import { type PreheatInstanceAction } from "../features/preheat/preheat-page";
import {
  CveExportDetailDialog,
  CveExportDialog,
  DeleteScannerDialog,
  ScannerDialog,
  ScannerMetadataDialog,
  SystemAllowlistDialog,
} from "../features/security/security-dialogs";
import { type SecurityAction } from "../features/security/security-page";
import type { ProjectPreheatAction } from "../features/projects/project-preheat-section";
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
import {
  DeleteImmutableTagRuleDialog,
  DeleteProjectLabelDialog,
  ImmutableTagRuleDialog,
  ProjectLabelDialog,
} from "../features/projects/project-rule-dialogs";
import type { ProjectRetentionAction } from "../features/projects/project-retention-section";
import {
  DeleteProjectRobotDialog,
  ProjectRobotDialog,
  ResetRobotSecretDialog,
} from "../features/projects/project-robot-dialogs";
import { RobotCredentialDialog } from "../components/robot-credential-dialog";
import {
  DeleteProjectWebhookDialog,
  ProjectWebhookDialog,
  WebhookHistoryDialog,
} from "../features/projects/project-webhook-dialogs";
import {
  DeleteRepositoriesDialog,
  DeleteRepositoryDialog,
  EditRepositoryDialog,
  PushCommandDialog,
} from "../features/projects/repository-dialogs";

import type { Dispatch, SetStateAction } from "react";
import type { ConsoleRoute } from "./hash-router";
export type ApplicationDialog =
  | { kind: "create" }
  | { kind: "delete"; projects: ProjectSummary[] }
  | { kind: "delete-project"; project: ProjectSummary }
  | { kind: "export"; project: ProjectSummary }
  | {
      kind: "delete-repositories";
      project: string;
      repositories: RepositorySummary[];
    }
  | { kind: "push-command"; project: string; repository?: string }
  | {
      kind: "edit-repository";
      project: string;
      repository: RepositorySummary;
    }
  | {
      kind: "delete-repository";
      project: string;
      repository: RepositorySummary;
    }
  | { kind: "artifact"; action: RepositoryArtifactAction }
  | { kind: "add-member"; project: string; members: ProjectMember[] }
  | { kind: "edit-member"; project: string; member: ProjectMember }
  | { kind: "delete-member"; project: string; member: ProjectMember }
  | { kind: "create-robot"; project: string; permissions: HarborPermission[] }
  | {
      kind: "edit-robot";
      project: string;
      robot: ProjectRobot;
      permissions: HarborPermission[];
    }
  | { kind: "reset-robot"; project: string; robot: ProjectRobot }
  | { kind: "delete-robot"; project: string; robot: ProjectRobot }
  | {
      kind: "create-webhook";
      project: string;
      metadata: WebhookEventMetadata;
    }
  | {
      kind: "edit-webhook";
      project: string;
      webhook: ProjectWebhook;
      metadata: WebhookEventMetadata;
    }
  | { kind: "webhook-history"; project: string; webhook: ProjectWebhook }
  | { kind: "delete-webhook"; project: string; webhook: ProjectWebhook }
  | {
      kind: "create-immutable-rule";
      project: string;
      metadata: RetentionMetadata;
    }
  | {
      kind: "edit-immutable-rule";
      project: string;
      rule: ImmutableTagRule;
      metadata: RetentionMetadata;
    }
  | {
      kind: "delete-immutable-rule";
      project: string;
      rule: ImmutableTagRule;
    }
  | { kind: "create-project-label"; project: string; projectId: number }
  | {
      kind: "edit-project-label";
      project: string;
      projectId: number;
      label: ProjectLabel;
    }
  | { kind: "delete-project-label"; label: ProjectLabel }
  | { kind: "retention"; action: ProjectRetentionAction }
  | { kind: "preheat"; action: ProjectPreheatAction }
  | {
      kind: "robot-credential";
      credential: RobotCredential;
      source: "create" | "reset";
    }
  | { kind: "artifact-detail"; action: ArtifactDetailAction }
  | { kind: "security"; action: SecurityAction }
  | { kind: "registry"; action: RegistryAction }
  | { kind: "replication"; action: ReplicationAction }
  | { kind: "preheat-instance"; action: PreheatInstanceAction };

type ApplicationDialogHostProps = {
  authMode: string;
  activeDialog: ApplicationDialog | undefined;
  setActiveDialog: Dispatch<SetStateAction<ApplicationDialog | undefined>>;
  session: Session | undefined;
  route: ConsoleRoute;
  navigate: (path: string) => void;
  showToast: (message: string, error?: boolean) => void;
  handleRefresh: () => Promise<void>;
  setProjectDetailVersion: Dispatch<SetStateAction<number>>;
  setRepositoryDetailVersion: Dispatch<SetStateAction<number>>;
  setArtifactDetailVersion: Dispatch<SetStateAction<number>>;
  handleSecurityChanged: (message: string) => void;
  handleRegistryChanged: (message: string) => void;
  handleReplicationChanged: (message: string) => void;
  handlePreheatInstanceChanged: (message: string) => void;
};
function ProjectDialogs({
  authMode,
  activeDialog,
  setActiveDialog,
  session,
  route,
  navigate,
  showToast,
  handleRefresh,
  setProjectDetailVersion,
  setRepositoryDetailVersion,
  setArtifactDetailVersion,
}: Pick<
  ApplicationDialogHostProps,
  | "authMode"
  | "activeDialog"
  | "setActiveDialog"
  | "session"
  | "route"
  | "navigate"
  | "showToast"
  | "handleRefresh"
  | "setProjectDetailVersion"
  | "setRepositoryDetailVersion"
  | "setArtifactDetailVersion"
>) {
  return (
    <>
      {" "}
      {activeDialog?.kind === "create" ? (
        <CreateProjectDialog
          onClose={() => setActiveDialog(undefined)}
          onCreated={(name) => {
            setActiveDialog(undefined);
            showToast(`项目 ${name} 已创建`);
            navigate(`projects/${encodeURIComponent(name)}`);
          }}
        />
      ) : null}
      {activeDialog?.kind === "delete" ? (
        <DeleteProjectsDialog
          projects={activeDialog.projects}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={(failures) => {
            const total = activeDialog.projects.length;
            setActiveDialog(undefined);
            showToast(
              failures
                ? `项目删除完成，${String(failures)} 项失败`
                : `${String(total)} 个项目已删除`,
              failures > 0,
            );
            if (!failures && total === 1 && route.view === "project") {
              navigate("projects");
            }
            void handleRefresh();
          }}
        />
      ) : null}
      {activeDialog?.kind === "delete-project" ? (
        <DeleteProjectDialog
          project={activeDialog.project}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={() => {
            const name = activeDialog.project.name;
            setActiveDialog(undefined);
            showToast(`项目 ${name} 已删除`);
            navigate("projects");
            void handleRefresh();
          }}
        />
      ) : null}
      {activeDialog?.kind === "export" ? (
        <ProjectCveExportDialog
          project={activeDialog.project}
          onClose={() => setActiveDialog(undefined)}
          onCreated={(id) => {
            setActiveDialog(undefined);
            showToast(`CVE 导出任务 #${String(id ?? "-")} 已创建`);
          }}
        />
      ) : null}
      {activeDialog?.kind === "delete-repositories" ? (
        <DeleteRepositoriesDialog
          project={activeDialog.project}
          repositories={activeDialog.repositories}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={(failures) => {
            const total = activeDialog.repositories.length;
            setActiveDialog(undefined);
            showToast(
              failures
                ? `仓库删除完成，${String(failures)} 项失败`
                : `${String(total)} 个仓库已删除`,
              failures > 0,
            );
            setProjectDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
        />
      ) : null}
      {activeDialog?.kind === "push-command" && session ? (
        <PushCommandDialog
          project={activeDialog.project}
          repository={activeDialog.repository}
          session={session}
          onClose={() => setActiveDialog(undefined)}
          onCopied={(copyError) =>
            showToast(
              copyError ? "无法写入剪贴板" : "已复制到剪贴板",
              copyError,
            )
          }
        />
      ) : null}
      {activeDialog?.kind === "edit-repository" ? (
        <EditRepositoryDialog
          project={activeDialog.project}
          repository={activeDialog.repository}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => {
            setActiveDialog(undefined);
            showToast("仓库描述已保存");
            setRepositoryDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
        />
      ) : null}
      {activeDialog?.kind === "delete-repository" ? (
        <DeleteRepositoryDialog
          project={activeDialog.project}
          repository={activeDialog.repository}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={() => {
            const project = activeDialog.project;
            setActiveDialog(undefined);
            showToast("仓库已删除");
            setProjectDetailVersion((current) => current + 1);
            void handleRefresh();
            navigate(`projects/${encodeURIComponent(project)}/repositories`);
          }}
        />
      ) : null}
      {activeDialog?.kind === "artifact" &&
      (activeDialog.action.kind === "attach-label" ||
        activeDialog.action.kind === "remove-label") ? (
        <ArtifactLabelDialog
          mode={
            activeDialog.action.kind === "attach-label" ? "attach" : "remove"
          }
          project={activeDialog.action.project}
          repository={activeDialog.action.repository}
          artifacts={activeDialog.action.artifacts}
          labels={activeDialog.action.labels}
          onClose={() => setActiveDialog(undefined)}
          onCompleted={(failures) => {
            const action = activeDialog.action;
            setActiveDialog(undefined);
            showToast(
              failures
                ? `${action.kind === "attach-label" ? "添加" : "移除"}标签完成，${String(failures)} 项失败`
                : action.kind === "attach-label"
                  ? "标签已添加"
                  : "标签已移除",
              failures > 0,
            );
            setRepositoryDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {activeDialog?.kind === "artifact" &&
      activeDialog.action.kind === "copy" ? (
        <CopyArtifactDialog
          project={activeDialog.action.project}
          repository={activeDialog.action.repository}
          artifact={activeDialog.action.artifact}
          onClose={() => setActiveDialog(undefined)}
          onCopied={(project, repository) => {
            setActiveDialog(undefined);
            showToast("制品复制已完成");
            navigate(
              `projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts`,
            );
          }}
        />
      ) : null}
      {activeDialog?.kind === "artifact" &&
      activeDialog.action.kind === "delete" ? (
        <DeleteArtifactsDialog
          project={activeDialog.action.project}
          repository={activeDialog.action.repository}
          artifacts={activeDialog.action.artifacts}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={(failures) => {
            const total =
              activeDialog.action.kind === "delete"
                ? activeDialog.action.artifacts.length
                : 0;
            setActiveDialog(undefined);
            showToast(
              failures
                ? `制品删除完成，${String(failures)} 项失败`
                : `${String(total)} 个制品已删除`,
              failures > 0,
            );
            setRepositoryDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
        />
      ) : null}
      {activeDialog?.kind === "artifact-detail" ? (
        <ArtifactDetailDialogHost
          action={activeDialog.action}
          onClose={() => setActiveDialog(undefined)}
          onChanged={(message) => {
            setActiveDialog(undefined);
            showToast(message);
            setArtifactDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
          onNavigate={(path, message) => {
            setActiveDialog(undefined);
            showToast(message);
            setArtifactDetailVersion((current) => current + 1);
            void handleRefresh();
            navigate(path);
          }}
          onNotice={showToast}
        />
      ) : null}
      {activeDialog?.kind === "add-member" ? (
        <AddProjectMemberDialog
          project={activeDialog.project}
          existingMembers={activeDialog.members}
          authMode={authMode}
          onClose={() => setActiveDialog(undefined)}
          onCreated={() => {
            setActiveDialog(undefined);
            showToast("项目成员已添加");
            setProjectDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
        />
      ) : null}
      {activeDialog?.kind === "edit-member" ? (
        <EditProjectMemberDialog
          project={activeDialog.project}
          member={activeDialog.member}
          onClose={() => setActiveDialog(undefined)}
          onUpdated={() => {
            setActiveDialog(undefined);
            showToast("成员角色已更新");
            setProjectDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
        />
      ) : null}
      {activeDialog?.kind === "delete-member" ? (
        <DeleteProjectMemberDialog
          project={activeDialog.project}
          member={activeDialog.member}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={() => {
            setActiveDialog(undefined);
            showToast("项目成员已删除");
            setProjectDetailVersion((current) => current + 1);
            void handleRefresh();
          }}
        />
      ) : null}
      {activeDialog?.kind === "create-robot" ? (
        <ProjectRobotDialog
          project={activeDialog.project}
          permissionCandidates={activeDialog.permissions}
          onClose={() => setActiveDialog(undefined)}
          onCreated={(credential) =>
            setActiveDialog({
              kind: "robot-credential",
              credential,
              source: "create",
            })
          }
          onUpdated={() => undefined}
        />
      ) : null}
      {activeDialog?.kind === "edit-robot" ? (
        <ProjectRobotDialog
          project={activeDialog.project}
          robot={activeDialog.robot}
          permissionCandidates={activeDialog.permissions}
          onClose={() => setActiveDialog(undefined)}
          onCreated={() => undefined}
          onUpdated={() => {
            setActiveDialog(undefined);
            showToast("机器人账号已更新");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {activeDialog?.kind === "reset-robot" ? (
        <ResetRobotSecretDialog
          robot={activeDialog.robot}
          onClose={() => setActiveDialog(undefined)}
          onReset={(credential) =>
            setActiveDialog({
              kind: "robot-credential",
              credential,
              source: "reset",
            })
          }
        />
      ) : null}
      {activeDialog?.kind === "delete-robot" ? (
        <DeleteProjectRobotDialog
          project={activeDialog.project}
          robot={activeDialog.robot}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={() => {
            setActiveDialog(undefined);
            showToast("机器人账号已删除");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {activeDialog?.kind === "create-webhook" ? (
        <ProjectWebhookDialog
          project={activeDialog.project}
          metadata={activeDialog.metadata}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => {
            setActiveDialog(undefined);
            showToast("Webhook 已创建");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {activeDialog?.kind === "edit-webhook" ? (
        <ProjectWebhookDialog
          project={activeDialog.project}
          webhook={activeDialog.webhook}
          metadata={activeDialog.metadata}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => {
            setActiveDialog(undefined);
            showToast("Webhook 已更新");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {activeDialog?.kind === "webhook-history" ? (
        <WebhookHistoryDialog
          project={activeDialog.project}
          webhook={activeDialog.webhook}
          onClose={() => setActiveDialog(undefined)}
          onNotice={showToast}
        />
      ) : null}
      {activeDialog?.kind === "delete-webhook" ? (
        <DeleteProjectWebhookDialog
          project={activeDialog.project}
          webhook={activeDialog.webhook}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={() => {
            setActiveDialog(undefined);
            showToast("Webhook 已删除");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {activeDialog?.kind === "create-immutable-rule" ? (
        <ImmutableTagRuleDialog
          project={activeDialog.project}
          metadata={activeDialog.metadata}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => {
            setActiveDialog(undefined);
            showToast("不可变规则已创建");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {activeDialog?.kind === "edit-immutable-rule" ? (
        <ImmutableTagRuleDialog
          project={activeDialog.project}
          rule={activeDialog.rule}
          metadata={activeDialog.metadata}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => {
            setActiveDialog(undefined);
            showToast("不可变规则已更新");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {activeDialog?.kind === "delete-immutable-rule" ? (
        <DeleteImmutableTagRuleDialog
          project={activeDialog.project}
          rule={activeDialog.rule}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={() => {
            setActiveDialog(undefined);
            showToast("不可变规则已删除");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {activeDialog?.kind === "create-project-label" ? (
        <ProjectLabelDialog
          project={activeDialog.project}
          projectId={activeDialog.projectId}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => {
            setActiveDialog(undefined);
            showToast("项目标签已创建");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {activeDialog?.kind === "edit-project-label" ? (
        <ProjectLabelDialog
          project={activeDialog.project}
          projectId={activeDialog.projectId}
          label={activeDialog.label}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => {
            setActiveDialog(undefined);
            showToast("项目标签已更新");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {activeDialog?.kind === "delete-project-label" ? (
        <DeleteProjectLabelDialog
          label={activeDialog.label}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={() => {
            setActiveDialog(undefined);
            showToast("项目标签已删除");
            setProjectDetailVersion((current) => current + 1);
          }}
        />
      ) : null}
      {activeDialog?.kind === "retention" ? (
        <RetentionDialogHost
          action={activeDialog.action}
          onClose={() => setActiveDialog(undefined)}
          onChanged={(message) => {
            setActiveDialog(undefined);
            showToast(message);
            setProjectDetailVersion((current) => current + 1);
          }}
          onNotice={showToast}
        />
      ) : null}
      {activeDialog?.kind === "preheat" ? (
        <PreheatDialogHost
          action={activeDialog.action}
          onClose={() => setActiveDialog(undefined)}
          onChanged={(message) => {
            setActiveDialog(undefined);
            showToast(message);
            setProjectDetailVersion((current) => current + 1);
          }}
          onNotice={showToast}
        />
      ) : null}
      {activeDialog?.kind === "robot-credential" ? (
        <RobotCredentialDialog
          credential={activeDialog.credential}
          onClose={() => {
            const message =
              activeDialog.source === "reset"
                ? "机器人密钥已重置"
                : "机器人账号已创建";
            setActiveDialog(undefined);
            showToast(message);
            setProjectDetailVersion((current) => current + 1);
          }}
          onCopied={(copyError) =>
            showToast(
              copyError ? "无法写入剪贴板" : "已复制到剪贴板",
              copyError,
            )
          }
        />
      ) : null}
    </>
  );
}
function SystemDialogs({
  activeDialog,
  setActiveDialog,
  showToast,
  handleSecurityChanged,
  handleRegistryChanged,
  handleReplicationChanged,
  handlePreheatInstanceChanged,
}: Pick<
  ApplicationDialogHostProps,
  | "activeDialog"
  | "setActiveDialog"
  | "showToast"
  | "handleSecurityChanged"
  | "handleRegistryChanged"
  | "handleReplicationChanged"
  | "handlePreheatInstanceChanged"
>) {
  return (
    <>
      {" "}
      {activeDialog?.kind === "security" &&
      activeDialog.action.kind === "create-scanner" ? (
        <ScannerDialog
          canDisable={activeDialog.action.canDisable}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => handleSecurityChanged("扫描器已注册")}
        />
      ) : null}
      {activeDialog?.kind === "security" &&
      activeDialog.action.kind === "edit-scanner" ? (
        <ScannerDialog
          scanner={activeDialog.action.scanner}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => handleSecurityChanged("扫描器已更新")}
        />
      ) : null}
      {activeDialog?.kind === "security" &&
      activeDialog.action.kind === "scanner-metadata" ? (
        <ScannerMetadataDialog
          scanner={activeDialog.action.scanner}
          onClose={() => setActiveDialog(undefined)}
        />
      ) : null}
      {activeDialog?.kind === "security" &&
      activeDialog.action.kind === "delete-scanner" ? (
        <DeleteScannerDialog
          scanner={activeDialog.action.scanner}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={() => handleSecurityChanged("扫描器已删除")}
        />
      ) : null}
      {activeDialog?.kind === "security" &&
      activeDialog.action.kind === "edit-allowlist" ? (
        <SystemAllowlistDialog
          allowlist={activeDialog.action.allowlist}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => handleSecurityChanged("系统 CVE 白名单已保存")}
        />
      ) : null}
      {activeDialog?.kind === "security" &&
      activeDialog.action.kind === "create-export" ? (
        <CveExportDialog
          projects={activeDialog.action.projects}
          onClose={() => setActiveDialog(undefined)}
          onCreated={(id) =>
            handleSecurityChanged(`CVE 导出任务 #${String(id ?? "-")} 已创建`)
          }
        />
      ) : null}
      {activeDialog?.kind === "security" &&
      activeDialog.action.kind === "export-detail" ? (
        <CveExportDetailDialog
          execution={activeDialog.action.execution}
          onClose={() => setActiveDialog(undefined)}
        />
      ) : null}
      {activeDialog?.kind === "registry" &&
      activeDialog.action.kind === "create" ? (
        <RegistryDialog
          adapters={activeDialog.action.adapters}
          adapterInfos={activeDialog.action.adapterInfos}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => handleRegistryChanged("远端仓库已创建")}
          onNotice={showToast}
        />
      ) : null}
      {activeDialog?.kind === "registry" &&
      activeDialog.action.kind === "edit" ? (
        <RegistryDialog
          registry={activeDialog.action.registry}
          adapters={activeDialog.action.adapters}
          adapterInfos={activeDialog.action.adapterInfos}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => handleRegistryChanged("远端仓库已更新")}
          onNotice={showToast}
        />
      ) : null}
      {activeDialog?.kind === "registry" &&
      activeDialog.action.kind === "delete" ? (
        <DeleteRegistryDialog
          registry={activeDialog.action.registry}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={() => handleRegistryChanged("远端仓库连接已删除")}
        />
      ) : null}
      {activeDialog?.kind === "replication" ? (
        <ReplicationDialogHost
          action={activeDialog.action}
          onClose={() => setActiveDialog(undefined)}
          onChanged={handleReplicationChanged}
          onNotice={showToast}
        />
      ) : null}
      {activeDialog?.kind === "preheat-instance" &&
      activeDialog.action.kind === "create" ? (
        <PreheatInstanceDialog
          providers={activeDialog.action.providers}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => handlePreheatInstanceChanged("P2P 实例已创建")}
          onNotice={showToast}
        />
      ) : null}
      {activeDialog?.kind === "preheat-instance" &&
      activeDialog.action.kind === "edit" ? (
        <PreheatInstanceDialog
          instance={activeDialog.action.instance}
          providers={activeDialog.action.providers}
          onClose={() => setActiveDialog(undefined)}
          onSaved={() => handlePreheatInstanceChanged("P2P 实例已更新")}
          onNotice={showToast}
        />
      ) : null}
      {activeDialog?.kind === "preheat-instance" &&
      activeDialog.action.kind === "delete" ? (
        <DeletePreheatInstanceDialog
          instance={activeDialog.action.instance}
          onClose={() => setActiveDialog(undefined)}
          onDeleted={() => handlePreheatInstanceChanged("P2P 实例已删除")}
        />
      ) : null}
    </>
  );
}
export function ApplicationDialogHost(props: ApplicationDialogHostProps) {
  return (
    <>
      <ProjectDialogs {...props} />
      <SystemDialogs {...props} />
    </>
  );
}
