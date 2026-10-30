import { useLocale } from "../../app/locale-context";
import { shortDigest } from "./artifact-utils";

import { useControlMutation } from "../../app/use-control-mutation";
import {
  type ArtifactDialogContext,
  affectedQueries,
  DestructiveConfirmation,
} from "./artifact-detail-dialogs-support";

export function DeleteArtifactDialog({
  project,
  repository,
  artifact,
  onClose,
  onDeleted,
}: ArtifactDialogContext & {
  onClose: () => void;
  onDeleted: () => void;
}) {
  const mutate = useControlMutation(affectedQueries);
  const { locale } = useLocale();
  return (
    <DestructiveConfirmation
      title="删除制品"
      subtitle={
        locale === "en-US"
          ? `Artifact ${shortDigest(artifact.digest)} and all of its tags will be permanently deleted.`
          : `制品 ${shortDigest(artifact.digest)} 及其全部 Tag 将被永久删除。`
      }
      submitLabel="删除制品"
      confirmation={artifact.digest}
      onClose={onClose}
      onConfirm={async () => {
        await mutate({
          operation: "artifact",
          parameters: { project, repository, reference: artifact.digest },
          method: "DELETE",
        });
        onDeleted();
      }}
    />
  );
}
