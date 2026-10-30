import type {
  ApplicationDialog,
  DialogCompletion,
  DialogControls,
} from "./application-dialogs";
import type { ConsoleRoute } from "./console-route";
import type { Session } from "./models";
import type { ReloadablePage } from "./page-refresh";
import { ProjectDialogRoute } from "./project-dialog-route";
import { ProjectPolicyDialogRoute } from "./project-policy-dialog-route";
import { RepositoryDialogRoute } from "./repository-dialog-route";
import { SystemDialogRoute } from "./system-dialog-route";

export type { ApplicationDialog } from "./application-dialogs";

/** Renders the open dialog and applies its result to the application. */
type ApplicationDialogHostProps = {
  dialog: ApplicationDialog;
  session: Session;
  route: ConsoleRoute;
  authMode: string;
  navigate: (path: string) => void;
  onDialogChange: (dialog: ApplicationDialog | undefined) => void;
  onNotice: (message: string, error?: boolean) => void;
  onRefreshConsole: () => Promise<void>;
  onReloadPage: (page: ReloadablePage) => void;
};

export function ApplicationDialogHost({
  dialog,
  session,
  route,
  authMode,
  navigate,
  onDialogChange,
  onNotice,
  onRefreshConsole,
  onReloadPage,
}: ApplicationDialogHostProps) {
  const close = () => {
    onDialogChange(undefined);
  };
  const complete = (
    message: string,
    { reload, refreshConsole, navigateTo, error }: DialogCompletion = {},
  ) => {
    close();
    onNotice(message, error);
    if (reload) onReloadPage(reload);
    if (refreshConsole) void onRefreshConsole();
    if (navigateTo) navigate(navigateTo);
  };
  const controls: DialogControls = {
    session,
    route,
    authMode,
    navigate,
    open: onDialogChange,
    close,
    notify: onNotice,
    complete,
  };
  return (
    <>
      <ProjectDialogRoute dialog={dialog} controls={controls} />
      <ProjectPolicyDialogRoute dialog={dialog} controls={controls} />
      <RepositoryDialogRoute dialog={dialog} controls={controls} />
      <SystemDialogRoute dialog={dialog} controls={controls} />
    </>
  );
}
