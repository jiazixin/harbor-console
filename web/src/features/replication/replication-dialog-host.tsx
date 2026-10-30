import { type ReplicationAction } from "../replication/replication-page";
import { DeleteReplicationPolicyDialog } from "./delete-replication-policy-dialog";
import { ReplicationExecutionDialog } from "./replication-execution-dialog";
import { ReplicationPolicyDialog } from "./replication-policy-dialog";
import { RunReplicationPolicyDialog } from "./run-replication-policy-dialog";

type ReplicationDialogHostProps = {
  action: ReplicationAction;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function ReplicationDialogHost({
  action,
  onClose,
  onChanged,
  onNotice,
}: ReplicationDialogHostProps) {
  switch (action.kind) {
    case "create":
      return (
        <ReplicationPolicyDialog
          registries={action.registries}
          labels={action.labels}
          localInfo={action.localInfo}
          onClose={onClose}
          onSaved={() => {
            onChanged("复制策略已创建");
          }}
        />
      );
    case "edit":
      return (
        <ReplicationPolicyDialog
          policy={action.policy}
          registries={action.registries}
          labels={action.labels}
          localInfo={action.localInfo}
          onClose={onClose}
          onSaved={() => {
            onChanged("复制策略已更新");
          }}
        />
      );
    case "run":
      return (
        <RunReplicationPolicyDialog
          policy={action.policy}
          onClose={onClose}
          onStarted={() => {
            onChanged("复制任务已启动");
          }}
        />
      );
    case "delete":
      return (
        <DeleteReplicationPolicyDialog
          policy={action.policy}
          onClose={onClose}
          onDeleted={() => {
            onChanged("复制策略已删除");
          }}
        />
      );
    case "execution":
      return (
        <ReplicationExecutionDialog
          execution={action.execution}
          onClose={onClose}
          onChanged={onChanged}
          onNotice={onNotice}
        />
      );
  }
}
