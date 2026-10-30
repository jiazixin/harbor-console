import { useLocale } from "../../app/locale-context";
import type { ArtifactTag } from "../../app/models";

import { useControlMutation } from "../../app/use-control-mutation";
import {
  type ArtifactDialogContext,
  affectedQueries,
  DestructiveConfirmation,
} from "./artifact-detail-dialogs-support";

export function DeleteArtifactTagDialog({
  project,
  repository,
  artifact,
  tag,
  onClose,
  onDeleted,
}: ArtifactDialogContext & {
  tag: ArtifactTag;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const mutate = useControlMutation(affectedQueries);
  const { locale } = useLocale();
  return (
    <DestructiveConfirmation
      title="删除 Tag"
      subtitle={
        locale === "en-US"
          ? `Tag ${tag.name} will be removed from this artifact. The artifact digest will not be deleted.`
          : `Tag ${tag.name} 将从当前制品移除，制品摘要本身不会被删除。`
      }
      submitLabel="删除 Tag"
      onClose={onClose}
      onConfirm={async () => {
        await mutate({
          operation: "artifact-tag",
          parameters: {
            project,
            repository,
            reference: artifact.digest,
            tag: tag.name,
          },
          method: "DELETE",
        });
        onDeleted();
      }}
    />
  );
}
