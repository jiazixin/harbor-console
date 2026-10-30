import { useLocale } from "../../app/locale-context";
import type { ProjectLabel } from "../../app/models";

import { useControlMutation } from "../../app/use-control-mutation";
import {
  type ArtifactDialogContext,
  affectedQueries,
  DestructiveConfirmation,
} from "./artifact-detail-dialogs-support";

export function RemoveArtifactLabelDialog({
  project,
  repository,
  artifact,
  label,
  onClose,
  onRemoved,
}: ArtifactDialogContext & {
  label: ProjectLabel;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const mutate = useControlMutation(affectedQueries);
  const { locale } = useLocale();
  return (
    <DestructiveConfirmation
      title="移除制品标签"
      subtitle={
        locale === "en-US"
          ? `Label ${label.name} will be removed from this artifact. The label definition will not be deleted.`
          : `标签 ${label.name} 将从当前制品移除，标签定义本身不会删除。`
      }
      submitLabel="移除标签"
      onClose={onClose}
      onConfirm={async () => {
        await mutate({
          operation: "artifact-label",
          parameters: {
            project,
            repository,
            reference: artifact.digest,
            label: label.id,
          },
          method: "DELETE",
        });
        onRemoved();
      }}
    />
  );
}
