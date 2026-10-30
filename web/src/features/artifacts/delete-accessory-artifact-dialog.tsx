import { useLocale } from "../../app/locale-context";
import type { ArtifactAccessory } from "../../app/models";
import { artifactAccessoryTypeLabel } from "./artifact-detail-sections-support";
import { shortDigest } from "./artifact-utils";

import { useControlMutation } from "../../app/use-control-mutation";
import {
  type ArtifactDialogContext,
  affectedQueries,
  DestructiveConfirmation,
} from "./artifact-detail-dialogs-support";

export function DeleteAccessoryArtifactDialog({
  project,
  repository,
  accessory,
  onClose,
  onDeleted,
}: ArtifactDialogContext & {
  accessory: ArtifactAccessory;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const accessoryLabel = t(artifactAccessoryTypeLabel(accessory.type));
  return (
    <DestructiveConfirmation
      title="删除关联制品"
      subtitle={
        locale === "en-US"
          ? `${accessoryLabel} ${shortDigest(accessory.digest)} will be permanently deleted from this repository.`
          : `${accessoryLabel} ${shortDigest(accessory.digest)} 将从当前仓库永久删除。`
      }
      submitLabel="删除关联制品"
      confirmation={accessory.digest}
      onClose={onClose}
      onConfirm={async () => {
        await mutate({
          operation: "artifact",
          parameters: { project, repository, reference: accessory.digest },
          method: "DELETE",
        });
        onDeleted();
      }}
    />
  );
}
