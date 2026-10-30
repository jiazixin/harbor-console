import { PreheatExecutionsDialog } from "../projects/project-preheat-executions";
import type { ProjectPreheatAction } from "../projects/project-preheat-section";
import { DeletePreheatPolicyDialog } from "./delete-preheat-policy-dialog";
import { PreheatPolicyDialog } from "./preheat-policy-dialog";
import { RunPreheatPolicyDialog } from "./run-preheat-policy-dialog";

type PreheatDialogHostProps = {
  action: ProjectPreheatAction;
  onClose: () => void;
  onChanged: (message: string) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function PreheatDialogHost({
  action,
  onClose,
  onChanged,
  onNotice,
}: PreheatDialogHostProps) {
  switch (action.kind) {
    case "create":
    case "edit":
      return (
        <PreheatPolicyDialog
          project={action.project}
          projectId={action.projectId}
          providers={action.providers}
          policy={action.kind === "edit" ? action.policy : undefined}
          onClose={onClose}
          onSaved={() => {
            onChanged(
              action.kind === "edit" ? "预热策略已更新" : "预热策略已创建",
            );
          }}
        />
      );
    case "delete":
      return (
        <DeletePreheatPolicyDialog
          project={action.project}
          policy={action.policy}
          onClose={onClose}
          onDeleted={() => {
            onChanged("预热策略已删除");
          }}
        />
      );
    case "run":
      return (
        <RunPreheatPolicyDialog
          project={action.project}
          policy={action.policy}
          onClose={onClose}
          onStarted={() => {
            onChanged("P2P 预热执行已启动");
          }}
        />
      );
    case "executions":
      return (
        <PreheatExecutionsDialog
          project={action.project}
          policy={action.policy}
          onClose={onClose}
          onChanged={onChanged}
          onNotice={onNotice}
        />
      );
  }
}
