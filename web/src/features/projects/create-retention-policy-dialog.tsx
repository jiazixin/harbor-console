import { useState } from "react";
import type { RetentionMetadata } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import {
  affectedQueries,
  retentionPolicyPayload,
  RetentionRuleFields,
  retentionRulePayload,
  useRetentionRuleEditor,
} from "./project-retention-dialogs-support";

type CreateRetentionPolicyDialogProps = {
  project: string;
  projectId: number;
  metadata: RetentionMetadata;
  onClose: () => void;
  onSaved: () => void;
};

export function CreateRetentionPolicyDialog({
  project,
  projectId,
  metadata,
  onClose,
  onSaved,
}: CreateRetentionPolicyDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const editor = useRetentionRuleEditor(undefined, metadata);
  const [cron, setCron] = useState("");
  return (
    <ControlDialog
      title="创建 Tag 保留策略"
      subtitle={project}
      submitLabel="创建策略"
      onClose={onClose}
      onSubmit={async () => {
        const rule = retentionRulePayload(undefined, editor);
        await mutate({
          operation: "retentions",
          parameters: {},
          method: "POST",
          payload: retentionPolicyPayload({
            projectId: projectId,
            rules: [rule],
            algorithm: "or",
            cron: cron,
          }),
        });
        onSaved();
      }}
    >
      <RetentionRuleFields editor={editor} cron={cron} onCronChange={setCron} />
    </ControlDialog>
  );
}
