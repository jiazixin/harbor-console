import { ArtifactDetailDialogHost } from "../features/artifacts/artifact-detail-dialog-host";
import { ArtifactLabelDialog } from "../features/artifacts/artifact-label-dialog";
import { CopyArtifactDialog } from "../features/artifacts/copy-artifact-dialog";
import { DeleteArtifactsDialog } from "../features/artifacts/delete-artifacts-dialog";
import { DeleteRepositoriesDialog } from "../features/projects/delete-repositories-dialog";
import { DeleteRepositoryDialog } from "../features/projects/delete-repository-dialog";
import { EditRepositoryDialog } from "../features/projects/edit-repository-dialog";
import { PushCommandDialog } from "../features/projects/push-command-dialog";
import {
  type ApplicationDialog,
  clipboardMessage,
} from "./application-dialogs";
import { type DialogRouteProps } from "./resource-dialog-routes-support";

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
          onCopied={(project, repository) => {
            complete("制品复制已完成", {
              navigateTo: artifactListPath(project, repository),
            });
          }}
        />
      );
    case "delete":
      return (
        <DeleteArtifactsDialog
          project={action.project}
          repository={action.repository}
          artifacts={action.artifacts}
          onClose={close}
          onDeleted={(failures) => {
            complete(
              failures
                ? `制品删除完成，${String(failures)} 项失败`
                : `${String(action.artifacts.length)} 个制品已删除`,
              {
                error: failures > 0,
                reload: "repository",
                refreshConsole: true,
              },
            );
          }}
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
          onDeleted={(failures) => {
            complete(
              failures
                ? `仓库删除完成，${String(failures)} 项失败`
                : `${String(dialog.repositories.length)} 个仓库已删除`,
              { error: failures > 0, reload: "project", refreshConsole: true },
            );
          }}
        />
      );
    case "push-command":
      return (
        <PushCommandDialog
          project={dialog.project}
          repository={dialog.repository}
          session={session}
          onClose={close}
          onCopied={(copyFailed) => {
            notify(clipboardMessage(copyFailed), copyFailed);
          }}
        />
      );
    case "edit-repository":
      return (
        <EditRepositoryDialog
          project={dialog.project}
          repository={dialog.repository}
          onClose={close}
          onSaved={() => {
            complete("仓库描述已保存", {
              reload: "repository",
              refreshConsole: true,
            });
          }}
        />
      );
    case "delete-repository":
      return (
        <DeleteRepositoryDialog
          project={dialog.project}
          repository={dialog.repository}
          onClose={close}
          onDeleted={() => {
            complete("仓库已删除", {
              reload: "project",
              refreshConsole: true,
              navigateTo: `projects/${encodeURIComponent(dialog.project)}/repositories`,
            });
          }}
        />
      );
    case "artifact":
      return <ArtifactActionDialog dialog={dialog} controls={controls} />;
    case "artifact-detail":
      return (
        <ArtifactDetailDialogHost
          action={dialog.action}
          onClose={close}
          onChanged={(message) => {
            complete(message, { reload: "artifact", refreshConsole: true });
          }}
          onNavigate={(path, message) => {
            complete(message, {
              reload: "artifact",
              refreshConsole: true,
              navigateTo: path,
            });
          }}
          onNotice={notify}
        />
      );
    default:
      return null;
  }
}
