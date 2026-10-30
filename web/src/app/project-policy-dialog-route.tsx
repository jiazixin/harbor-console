import { DeleteImmutableTagRuleDialog } from "../features/projects/delete-immutable-tag-rule-dialog";
import { DeleteProjectLabelDialog } from "../features/projects/delete-project-label-dialog";
import { DeleteProjectWebhookDialog } from "../features/projects/delete-project-webhook-dialog";
import { ImmutableTagRuleDialog } from "../features/projects/immutable-tag-rule-dialog";
import { ProjectLabelDialog } from "../features/projects/project-label-dialog";
import { PreheatDialogHost } from "../features/projects/project-preheat-dialog-host";
import { RetentionDialogHost } from "../features/projects/project-retention-dialog-host";
import { ProjectWebhookDialog } from "../features/projects/project-webhook-dialog";
import { WebhookHistoryDialog } from "../features/projects/project-webhook-history";
import {
  type ApplicationDialog,
  type DialogControls,
} from "./application-dialogs";

/** Project webhook, immutability, label, retention and preheat dialogs. */
type ProjectPolicyDialogRouteProps = {
  dialog: ApplicationDialog;
  controls: DialogControls;
};

export function ProjectPolicyDialogRoute({
  dialog,
  controls,
}: ProjectPolicyDialogRouteProps) {
  const { close, complete, notify } = controls;
  const changedProject = { reload: "project" } as const;

  switch (dialog.kind) {
    case "create-webhook":
      return (
        <ProjectWebhookDialog
          project={dialog.project}
          metadata={dialog.metadata}
          onClose={close}
          onSaved={() => {
            complete("Webhook 已创建", changedProject);
          }}
        />
      );
    case "edit-webhook":
      return (
        <ProjectWebhookDialog
          project={dialog.project}
          webhook={dialog.webhook}
          metadata={dialog.metadata}
          onClose={close}
          onSaved={() => {
            complete("Webhook 已更新", changedProject);
          }}
        />
      );
    case "webhook-history":
      return (
        <WebhookHistoryDialog
          project={dialog.project}
          webhook={dialog.webhook}
          onClose={close}
          onNotice={notify}
        />
      );
    case "delete-webhook":
      return (
        <DeleteProjectWebhookDialog
          project={dialog.project}
          webhook={dialog.webhook}
          onClose={close}
          onDeleted={() => {
            complete("Webhook 已删除", changedProject);
          }}
        />
      );
    case "create-immutable-rule":
      return (
        <ImmutableTagRuleDialog
          project={dialog.project}
          metadata={dialog.metadata}
          onClose={close}
          onSaved={() => {
            complete("不可变规则已创建", changedProject);
          }}
        />
      );
    case "edit-immutable-rule":
      return (
        <ImmutableTagRuleDialog
          project={dialog.project}
          rule={dialog.rule}
          metadata={dialog.metadata}
          onClose={close}
          onSaved={() => {
            complete("不可变规则已更新", changedProject);
          }}
        />
      );
    case "delete-immutable-rule":
      return (
        <DeleteImmutableTagRuleDialog
          project={dialog.project}
          rule={dialog.rule}
          onClose={close}
          onDeleted={() => {
            complete("不可变规则已删除", changedProject);
          }}
        />
      );
    case "create-project-label":
      return (
        <ProjectLabelDialog
          project={dialog.project}
          projectId={dialog.projectId}
          onClose={close}
          onSaved={() => {
            complete("项目标签已创建", changedProject);
          }}
        />
      );
    case "edit-project-label":
      return (
        <ProjectLabelDialog
          project={dialog.project}
          projectId={dialog.projectId}
          label={dialog.label}
          onClose={close}
          onSaved={() => {
            complete("项目标签已更新", changedProject);
          }}
        />
      );
    case "delete-project-label":
      return (
        <DeleteProjectLabelDialog
          label={dialog.label}
          onClose={close}
          onDeleted={() => {
            complete("项目标签已删除", changedProject);
          }}
        />
      );
    case "retention":
      return (
        <RetentionDialogHost
          action={dialog.action}
          onClose={close}
          onChanged={(message) => {
            complete(message, changedProject);
          }}
          onNotice={notify}
        />
      );
    case "preheat":
      return (
        <PreheatDialogHost
          action={dialog.action}
          onClose={close}
          onChanged={(message) => {
            complete(message, changedProject);
          }}
          onNotice={notify}
        />
      );
    default:
      return null;
  }
}
