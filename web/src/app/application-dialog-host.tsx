import type {
  ApplicationDialog,
  DialogCompletion,
  DialogControls,
} from "./application-dialogs";
import type { ConsoleRoute } from "./hash-router";
import type { Session } from "./models";
import type { ReloadablePage } from "./page-versions";
import {
  ProjectDialogRoute,
  ProjectPolicyDialogRoute,
} from "./project-dialog-routes";
import {
  RepositoryDialogRoute,
  SystemDialogRoute,
} from "./resource-dialog-routes";

export type { ApplicationDialog } from "./application-dialogs";

/** Renders the open dialog and applies its result to the application. */
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
}: {
  dialog: ApplicationDialog;
  session: Session;
  route: ConsoleRoute;
  authMode: string;
  navigate: (path: string) => void;
  onDialogChange: (dialog: ApplicationDialog | undefined) => void;
  onNotice: (message: string, error?: boolean) => void;
  onRefreshConsole: () => Promise<void>;
  onReloadPage: (page: ReloadablePage) => void;
}) {
  const close = () => onDialogChange(undefined);
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
