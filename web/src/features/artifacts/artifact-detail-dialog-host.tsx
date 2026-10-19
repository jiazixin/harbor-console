import { CopyArtifactDialog } from "../artifacts/artifact-dialogs";
import {
  AddArtifactTagDialog,
  ArtifactScanDialog,
  ArtifactScanLogDialog,
  AttachArtifactLabelDialog,
  DeleteAccessoryArtifactDialog,
  DeleteArtifactDialog,
  DeleteArtifactTagDialog,
  RemoveArtifactLabelDialog,
  StopArtifactScanDialog,
} from "../artifacts/artifact-detail-dialogs";
import type { ArtifactDetailAction } from "./artifact-detail-data";

export function ArtifactDetailDialogHost({
  action,
  onClose,
  onChanged,
  onNavigate,
  onNotice,
}: {
  action: ArtifactDetailAction;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNavigate: (path: string, message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const context = {
    project: action.project,
    repository: action.repository,
    artifact: action.artifact,
  };
  switch (action.kind) {
    case "scan":
      return (
        <ArtifactScanDialog
          {...context}
          onClose={onClose}
          onSubmitted={(scanType) =>
            onChanged(
              scanType === "sbom"
                ? "SBOM 生成任务已提交"
                : "漏洞扫描任务已提交",
            )
          }
        />
      );
    case "stop-scan":
      return (
        <StopArtifactScanDialog
          {...context}
          scanType={action.scanType}
          onClose={onClose}
          onStopped={() =>
            onChanged(
              action.scanType === "sbom" ? "SBOM 生成已停止" : "漏洞扫描已停止",
            )
          }
        />
      );
    case "scan-log":
      return (
        <ArtifactScanLogDialog
          {...context}
          reportId={action.reportId}
          onClose={onClose}
          onNotice={onNotice}
        />
      );
    case "add-tag":
      return (
        <AddArtifactTagDialog
          {...context}
          onClose={onClose}
          onCreated={(name) =>
            onNavigate(
              `projects/${encodeURIComponent(action.project)}/repositories/${encodeURIComponent(action.repository)}/artifacts/${encodeURIComponent(action.artifact.digest)}?tab=tags`,
              `Tag ${name} 已创建`,
            )
          }
        />
      );
    case "delete-tag":
      return (
        <DeleteArtifactTagDialog
          {...context}
          tag={action.tag}
          onClose={onClose}
          onDeleted={() => onChanged(`Tag ${action.tag.name} 已删除`)}
        />
      );
    case "attach-label":
      return (
        <AttachArtifactLabelDialog
          {...context}
          labels={action.labels}
          onClose={onClose}
          onAttached={(label) => onChanged(`标签 ${label.name} 已绑定`)}
        />
      );
    case "remove-label":
      return (
        <RemoveArtifactLabelDialog
          {...context}
          label={action.label}
          onClose={onClose}
          onRemoved={() => onChanged(`标签 ${action.label.name} 已移除`)}
        />
      );
    case "copy":
      return (
        <CopyArtifactDialog
          {...context}
          onClose={onClose}
          onCopied={(project, repository) =>
            onNavigate(
              `projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts`,
              "制品复制已完成",
            )
          }
        />
      );
    case "delete":
      return (
        <DeleteArtifactDialog
          {...context}
          onClose={onClose}
          onDeleted={() =>
            onNavigate(
              `projects/${encodeURIComponent(action.project)}/repositories/${encodeURIComponent(action.repository)}/artifacts`,
              "制品已删除",
            )
          }
        />
      );
    case "delete-accessory":
      return (
        <DeleteAccessoryArtifactDialog
          {...context}
          accessory={action.accessory}
          onClose={onClose}
          onDeleted={() => onChanged("关联制品已删除")}
        />
      );
  }
}
