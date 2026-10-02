import {
  CreateRetentionPolicyDialog,
  DeleteRetentionPolicyDialog,
  DeleteRetentionRuleDialog,
  RetentionExecutionDialog,
  RetentionRuleDialog,
  RetentionScheduleDialog,
  RunRetentionDialog,
  StopRetentionExecutionDialog,
} from "../projects/project-retention-dialogs";
import type { ProjectRetentionAction } from "../projects/project-retention-section";

export function RetentionDialogHost({
  action,
  onClose,
  onChanged,
  onNotice,
}: {
  action: ProjectRetentionAction;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  switch (action.kind) {
    case "create-policy":
      return (
        <CreateRetentionPolicyDialog
          project={action.project}
          projectId={action.projectId}
          metadata={action.metadata}
          onClose={onClose}
          onSaved={() => onChanged("Tag 保留策略已创建")}
        />
      );
    case "edit-schedule":
      return (
        <RetentionScheduleDialog
          projectId={action.projectId}
          policy={action.policy}
          onClose={onClose}
          onSaved={() => onChanged("Tag 保留执行计划已更新")}
        />
      );
    case "add-rule":
    case "edit-rule":
      return (
        <RetentionRuleDialog
          projectId={action.projectId}
          policy={action.policy}
          metadata={action.metadata}
          ruleIndex={action.kind === "edit-rule" ? action.ruleIndex : undefined}
          onClose={onClose}
          onSaved={() =>
            onChanged(
              action.kind === "edit-rule"
                ? "Tag 保留规则已更新"
                : "Tag 保留规则已添加",
            )
          }
        />
      );
    case "delete-rule":
      return (
        <DeleteRetentionRuleDialog
          projectId={action.projectId}
          policy={action.policy}
          ruleIndex={action.ruleIndex}
          onClose={onClose}
          onDeleted={() => onChanged("Tag 保留规则已删除")}
        />
      );
    case "delete-policy":
      return (
        <DeleteRetentionPolicyDialog
          policy={action.policy}
          onClose={onClose}
          onDeleted={() => onChanged("Tag 保留策略已删除")}
        />
      );
    case "run":
      return (
        <RunRetentionDialog
          policy={action.policy}
          dryRun={action.dryRun}
          onClose={onClose}
          onStarted={() =>
            onChanged(
              action.dryRun ? "Tag 保留演练已启动" : "Tag 保留任务已启动",
            )
          }
        />
      );
    case "stop-execution":
      return (
        <StopRetentionExecutionDialog
          policy={action.policy}
          execution={action.execution}
          onClose={onClose}
          onStopped={() => onChanged("Tag 保留执行已停止")}
        />
      );
    case "view-execution":
      return (
        <RetentionExecutionDialog
          project={action.project}
          policy={action.policy}
          execution={action.execution}
          onClose={onClose}
          onNotice={onNotice}
        />
      );
  }
}
