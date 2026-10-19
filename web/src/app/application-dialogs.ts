import type { ArtifactDetailAction } from "../features/artifacts/artifact-detail-data";
import type { RepositoryArtifactAction } from "../features/artifacts/repository-detail-page";
import type { PreheatInstanceAction } from "../features/preheat/preheat-page";
import type { ProjectPreheatAction } from "../features/projects/project-preheat-section";
import type { ProjectRetentionAction } from "../features/projects/project-retention-section";
import type { RegistryAction } from "../features/registries/registries-page";
import type { ReplicationAction } from "../features/replication/replication-page";
import type { SecurityAction } from "../features/security/security-page";
import type { ConsoleRoute } from "./hash-router";
import type {
  HarborPermission,
  ImmutableTagRule,
  ProjectLabel,
  ProjectMember,
  ProjectRobot,
  ProjectSummary,
  ProjectWebhook,
  RepositorySummary,
  RetentionMetadata,
  RobotCredential,
  Session,
  WebhookEventMetadata,
} from "./models";
import type { ReloadablePage } from "./page-versions";

/** Every dialog the application can show; only one is open at a time. */
export type ApplicationDialog =
  | { kind: "create" }
  | { kind: "delete"; projects: ProjectSummary[] }
  | { kind: "delete-project"; project: ProjectSummary }
  | { kind: "export"; project: ProjectSummary }
  | {
      kind: "delete-repositories";
      project: string;
      repositories: RepositorySummary[];
    }
  | { kind: "push-command"; project: string; repository?: string }
  | {
      kind: "edit-repository";
      project: string;
      repository: RepositorySummary;
    }
  | {
      kind: "delete-repository";
      project: string;
      repository: RepositorySummary;
    }
  | { kind: "artifact"; action: RepositoryArtifactAction }
  | { kind: "add-member"; project: string; members: ProjectMember[] }
  | { kind: "edit-member"; project: string; member: ProjectMember }
  | { kind: "delete-member"; project: string; member: ProjectMember }
  | { kind: "create-robot"; project: string; permissions: HarborPermission[] }
  | {
      kind: "edit-robot";
      project: string;
      robot: ProjectRobot;
      permissions: HarborPermission[];
    }
  | { kind: "reset-robot"; project: string; robot: ProjectRobot }
  | { kind: "delete-robot"; project: string; robot: ProjectRobot }
  | {
      kind: "create-webhook";
      project: string;
      metadata: WebhookEventMetadata;
    }
  | {
      kind: "edit-webhook";
      project: string;
      webhook: ProjectWebhook;
      metadata: WebhookEventMetadata;
    }
  | { kind: "webhook-history"; project: string; webhook: ProjectWebhook }
  | { kind: "delete-webhook"; project: string; webhook: ProjectWebhook }
  | {
      kind: "create-immutable-rule";
      project: string;
      metadata: RetentionMetadata;
    }
  | {
      kind: "edit-immutable-rule";
      project: string;
      rule: ImmutableTagRule;
      metadata: RetentionMetadata;
    }
  | {
      kind: "delete-immutable-rule";
      project: string;
      rule: ImmutableTagRule;
    }
  | { kind: "create-project-label"; project: string; projectId: number }
  | {
      kind: "edit-project-label";
      project: string;
      projectId: number;
      label: ProjectLabel;
    }
  | { kind: "delete-project-label"; label: ProjectLabel }
  | { kind: "retention"; action: ProjectRetentionAction }
  | { kind: "preheat"; action: ProjectPreheatAction }
  | {
      kind: "robot-credential";
      credential: RobotCredential;
      source: "create" | "reset";
    }
  | { kind: "artifact-detail"; action: ArtifactDetailAction }
  | { kind: "security"; action: SecurityAction }
  | { kind: "registry"; action: RegistryAction }
  | { kind: "replication"; action: ReplicationAction }
  | { kind: "preheat-instance"; action: PreheatInstanceAction };

export type ApplicationDialogKind = ApplicationDialog["kind"];

/** What happens after a dialog finishes a change. */
export type DialogCompletion = {
  /** The page showing the changed data; it reloads from Harbor. */
  reload?: ReloadablePage;
  /** Also reload the console summary used by the shell and overview. */
  refreshConsole?: boolean;
  navigateTo?: string;
  error?: boolean;
};

/** The application services a dialog route needs. */
export type DialogControls = {
  session: Session;
  route: ConsoleRoute;
  authMode: string;
  navigate: (path: string) => void;
  open: (dialog: ApplicationDialog) => void;
  close: () => void;
  notify: (message: string, error?: boolean) => void;
  /** Closes the dialog, shows the message and applies the completion. */
  complete: (message: string, completion?: DialogCompletion) => void;
};

/** The clipboard result message shared by dialogs with a copy button. */
export function clipboardMessage(copyFailed = false): string {
  return copyFailed ? "无法写入剪贴板" : "已复制到剪贴板";
}
