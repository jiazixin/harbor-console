import { ArtifactDetailDialogHost } from "../features/artifacts/artifact-detail-dialog-host";
import {
  ArtifactLabelDialog,
  CopyArtifactDialog,
  DeleteArtifactsDialog,
} from "../features/artifacts/artifact-dialogs";
import {
  DeletePreheatInstanceDialog,
  PreheatInstanceDialog,
} from "../features/preheat/preheat-dialogs";
import {
  DeleteRepositoriesDialog,
  DeleteRepositoryDialog,
  EditRepositoryDialog,
  PushCommandDialog,
} from "../features/projects/repository-dialogs";
import {
  DeleteRegistryDialog,
  RegistryDialog,
} from "../features/registries/registry-dialogs";
import { ReplicationDialogHost } from "../features/replication/replication-dialog-host";
import {
  CveExportDetailDialog,
  CveExportDialog,
  DeleteScannerDialog,
  ScannerDialog,
  ScannerMetadataDialog,
  SystemAllowlistDialog,
} from "../features/security/security-dialogs";
import {
  type ApplicationDialog,
  clipboardMessage,
  type DialogControls,
} from "./application-dialogs";

type DialogRouteProps<Dialog extends ApplicationDialog = ApplicationDialog> = {
  dialog: Dialog;
  controls: DialogControls;
};

function artifactListPath(project: string, repository: string): string {
  return `projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts`;
}

function ArtifactActionDialog({
  dialog,
  controls,
}: DialogRouteProps<Extract<ApplicationDialog, { kind: "artifact" }>>) {
  const { close, complete } = controls;
  const action = dialog.action;
  switch (action.kind) {
    case "attach-label":
    case "remove-label": {
      const attaching = action.kind === "attach-label";
      return (
        <ArtifactLabelDialog
          mode={attaching ? "attach" : "remove"}
          project={action.project}
          repository={action.repository}
          artifacts={action.artifacts}
          labels={action.labels}
          onClose={close}
          onCompleted={(failures) => {
            const succeeded = attaching ? "标签已添加" : "标签已移除";
            const partlyFailed = attaching
              ? `添加标签完成，${String(failures)} 项失败`
              : `移除标签完成，${String(failures)} 项失败`;
            complete(failures ? partlyFailed : succeeded, {
              error: failures > 0,
              reload: "repository",
            });
          }}
        />
      );
    }
    case "copy":
      return (
        <CopyArtifactDialog
          project={action.project}
          repository={action.repository}
          artifact={action.artifact}
          onClose={close}
          onCopied={(project, repository) =>
            complete("制品复制已完成", {
              navigateTo: artifactListPath(project, repository),
            })
          }
        />
      );
    case "delete":
      return (
        <DeleteArtifactsDialog
          project={action.project}
          repository={action.repository}
          artifacts={action.artifacts}
          onClose={close}
          onDeleted={(failures) =>
            complete(
              failures
                ? `制品删除完成，${String(failures)} 项失败`
                : `${String(action.artifacts.length)} 个制品已删除`,
              {
                error: failures > 0,
                reload: "repository",
                refreshConsole: true,
              },
            )
          }
        />
      );
  }
}

/** Repository and artifact dialogs. */
export function RepositoryDialogRoute({ dialog, controls }: DialogRouteProps) {
  const { close, complete, notify, session } = controls;
  switch (dialog.kind) {
    case "delete-repositories":
      return (
        <DeleteRepositoriesDialog
          project={dialog.project}
          repositories={dialog.repositories}
          onClose={close}
          onDeleted={(failures) =>
            complete(
              failures
                ? `仓库删除完成，${String(failures)} 项失败`
                : `${String(dialog.repositories.length)} 个仓库已删除`,
              { error: failures > 0, reload: "project", refreshConsole: true },
            )
          }
        />
      );
    case "push-command":
      return (
        <PushCommandDialog
          project={dialog.project}
          repository={dialog.repository}
          session={session}
          onClose={close}
          onCopied={(copyFailed) =>
            notify(clipboardMessage(copyFailed), copyFailed)
          }
        />
      );
    case "edit-repository":
      return (
        <EditRepositoryDialog
          project={dialog.project}
          repository={dialog.repository}
          onClose={close}
          onSaved={() =>
            complete("仓库描述已保存", {
              reload: "repository",
              refreshConsole: true,
            })
          }
        />
      );
    case "delete-repository":
      return (
        <DeleteRepositoryDialog
          project={dialog.project}
          repository={dialog.repository}
          onClose={close}
          onDeleted={() =>
            complete("仓库已删除", {
              reload: "project",
              refreshConsole: true,
              navigateTo: `projects/${encodeURIComponent(dialog.project)}/repositories`,
            })
          }
        />
      );
    case "artifact":
      return <ArtifactActionDialog dialog={dialog} controls={controls} />;
    case "artifact-detail":
      return (
        <ArtifactDetailDialogHost
          action={dialog.action}
          onClose={close}
          onChanged={(message) =>
            complete(message, { reload: "artifact", refreshConsole: true })
          }
          onNavigate={(path, message) =>
            complete(message, {
              reload: "artifact",
              refreshConsole: true,
              navigateTo: path,
            })
          }
          onNotice={notify}
        />
      );
    default:
      return null;
  }
}

/** Scanner, CVE, remote registry, replication and P2P instance dialogs. */
export function SystemDialogRoute({ dialog, controls }: DialogRouteProps) {
  const { close, complete, notify } = controls;
  const changed =
    (reload: "preheat" | "registries" | "replication" | "security") =>
    (message: string) =>
      complete(message, { reload, refreshConsole: true });
  const securityChanged = changed("security");
  const registriesChanged = changed("registries");
  const preheatChanged = changed("preheat");

  switch (dialog.kind) {
    case "security": {
      const action = dialog.action;
      switch (action.kind) {
        case "create-scanner":
          return (
            <ScannerDialog
              canDisable={action.canDisable}
              onClose={close}
              onSaved={() => securityChanged("扫描器已注册")}
            />
          );
        case "edit-scanner":
          return (
            <ScannerDialog
              scanner={action.scanner}
              onClose={close}
              onSaved={() => securityChanged("扫描器已更新")}
            />
          );
        case "scanner-metadata":
          return (
            <ScannerMetadataDialog scanner={action.scanner} onClose={close} />
          );
        case "delete-scanner":
          return (
            <DeleteScannerDialog
              scanner={action.scanner}
              onClose={close}
              onDeleted={() => securityChanged("扫描器已删除")}
            />
          );
        case "edit-allowlist":
          return (
            <SystemAllowlistDialog
              allowlist={action.allowlist}
              onClose={close}
              onSaved={() => securityChanged("系统 CVE 白名单已保存")}
            />
          );
        case "create-export":
          return (
            <CveExportDialog
              projects={action.projects}
              onClose={close}
              onCreated={(id) =>
                securityChanged(`CVE 导出任务 #${String(id ?? "-")} 已创建`)
              }
            />
          );
        case "export-detail":
          return (
            <CveExportDetailDialog
              execution={action.execution}
              onClose={close}
            />
          );
        default:
          return null;
      }
    }
    case "registry": {
      const action = dialog.action;
      switch (action.kind) {
        case "create":
          return (
            <RegistryDialog
              adapters={action.adapters}
              adapterInfos={action.adapterInfos}
              onClose={close}
              onSaved={() => registriesChanged("远端仓库已创建")}
              onNotice={notify}
            />
          );
        case "edit":
          return (
            <RegistryDialog
              registry={action.registry}
              adapters={action.adapters}
              adapterInfos={action.adapterInfos}
              onClose={close}
              onSaved={() => registriesChanged("远端仓库已更新")}
              onNotice={notify}
            />
          );
        case "delete":
          return (
            <DeleteRegistryDialog
              registry={action.registry}
              onClose={close}
              onDeleted={() => registriesChanged("远端仓库连接已删除")}
            />
          );
        default:
          return null;
      }
    }
    case "replication":
      return (
        <ReplicationDialogHost
          action={dialog.action}
          onClose={close}
          onChanged={changed("replication")}
          onNotice={notify}
        />
      );
    case "preheat-instance": {
      const action = dialog.action;
      switch (action.kind) {
        case "create":
          return (
            <PreheatInstanceDialog
              providers={action.providers}
              onClose={close}
              onSaved={() => preheatChanged("P2P 实例已创建")}
              onNotice={notify}
            />
          );
        case "edit":
          return (
            <PreheatInstanceDialog
              instance={action.instance}
              providers={action.providers}
              onClose={close}
              onSaved={() => preheatChanged("P2P 实例已更新")}
              onNotice={notify}
            />
          );
        case "delete":
          return (
            <DeletePreheatInstanceDialog
              instance={action.instance}
              onClose={close}
              onDeleted={() => preheatChanged("P2P 实例已删除")}
            />
          );
        default:
          return null;
      }
    }
    default:
      return null;
  }
}
