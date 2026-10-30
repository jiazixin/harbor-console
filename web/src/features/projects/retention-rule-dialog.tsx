import { useLocale } from "../../app/locale-context";
import type { RetentionMetadata, RetentionPolicy } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import {
  affectedQueries,
  retentionPolicyPayload,
  retentionPolicySubtitle,
  RetentionRuleFields,
  retentionRulePayload,
  useRetentionRuleEditor,
} from "./project-retention-dialogs-support";

type RetentionRuleDialogProps = {
  projectId: number;
  policy: RetentionPolicy;
  metadata: RetentionMetadata;
  ruleIndex?: number;
  onClose: () => void;
  onSaved: () => void;
};

export function RetentionRuleDialog({
  projectId,
  policy,
  metadata,
  ruleIndex,
  onClose,
  onSaved,
}: RetentionRuleDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const rules = policy.rules ?? [];
  const editingIndex =
    ruleIndex !== undefined && ruleIndex >= 0 && ruleIndex < rules.length
      ? ruleIndex
      : undefined;
  const existing = editingIndex === undefined ? undefined : rules[editingIndex];
  const editor = useRetentionRuleEditor(existing, metadata);
  return (
    <ControlDialog
      title={
        editingIndex === undefined ? "添加 Tag 保留规则" : "编辑 Tag 保留规则"
      }
      subtitle={retentionPolicySubtitle(t, policy.id)}
      submitLabel={editingIndex === undefined ? "添加规则" : "保存规则"}
      onClose={onClose}
      onSubmit={async () => {
        const nextRules = rules.map((rule) => ({ ...rule }));
        const nextRule = retentionRulePayload(existing, editor);
        if (editingIndex !== undefined) nextRules[editingIndex] = nextRule;
        else nextRules.push(nextRule);
        await mutate({
          operation: "retention",
          parameters: { id: policy.id },
          method: "PUT",
          payload: retentionPolicyPayload({
            projectId: projectId,
            rules: nextRules,
            algorithm: policy.algorithm,
            cron: policy.trigger?.settings?.cron,
          }),
        });
        onSaved();
      }}
    >
      <RetentionRuleFields editor={editor} />
    </ControlDialog>
  );
}
