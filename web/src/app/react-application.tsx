import { lazy, useEffect, useState } from "react";
import { Outlet } from "react-router";
import { AsyncContent } from "../components/async-content";
import { ErrorView } from "../components/error-view";
import { IconSprite } from "../components/icon-sprite";
import { LoadingView } from "../components/loading-view";
import uiStyles0 from "../components/shared-ui.module.css";
import { ToastRegion } from "../components/toast-region";
import { ApplicationShell } from "../layouts/application-shell";
import { createClassNames } from "../lib/css/class-names";
import type { ApplicationDialog } from "./application-dialogs";
import { useConsoleRoute } from "./console-route";
import {
  type ConsoleRouteContext,
  navigationView,
  viewTitles,
} from "./console-routes";
import { errorText } from "./errors";
import { useLocale } from "./locale-context";
import type { HarborIdentity, Session } from "./models";
import { usePageRefresh } from "./page-refresh";
import { useSession } from "./session-provider";
import { useToast } from "./toast-provider";

const LoginPage = lazy(() =>
  import("../features/auth/login-page").then((module) => ({
    default: module.LoginPage,
  })),
);
const ApplicationDialogHost = lazy(() =>
  import("./application-dialog-host").then((module) => ({
    default: module.ApplicationDialogHost,
  })),
);

export function ReactApplication() {
  const { route, navigate } = useConsoleRoute();
  const { t } = useLocale();
  const {
    session,
    consoleData,
    sessionError,
    isBooting,
    isRefreshing,
    authenticate,
    refresh,
    logout,
    updateIdentity,
  } = useSession();
  const { toast, showToast } = useToast();
  const { reloadPage } = usePageRefresh();
  // A dialog belongs to the Harbor connection that opened it.
  const [dialogState, setDialogState] = useState<{
    dialog: ApplicationDialog;
    connection?: string;
  }>();
  const activeDialog =
    dialogState?.connection === session?.connection_id
      ? dialogState?.dialog
      : undefined;
  const setActiveDialog = (dialog: ApplicationDialog | undefined) => {
    setDialogState(dialog && { dialog, connection: session?.connection_id });
  };

  useEffect(() => {
    const pageTitle = session
      ? (viewTitles[route.view] ?? "页面不存在")
      : "连接实例";
    const previousTitle = document.title;
    document.title = `${t(pageTitle)} · ${t("Harbor 控制台")}`;
    return () => {
      document.title = previousTitle;
    };
  }, [route.view, session, t]);

  function handleIdentityChanged(identity: HarborIdentity, message: string) {
    updateIdentity(identity);
    showToast(message);
  }

  async function handleLogout() {
    try {
      await logout();
      setActiveDialog(undefined);
    } catch (error) {
      showToast(errorText(error), true);
    }
  }

  async function handleSessionChanged(current: Session, message: string) {
    setActiveDialog(undefined);
    await authenticate(current);
    showToast(message);
  }

  function renderContent() {
    if (isBooting) {
      return (
        <div className={resolveClasses("loading-state")}>
          <div>
            <span className={resolveClasses("spinner")} />
          </div>
        </div>
      );
    }
    if (!session) {
      return (
        <AsyncContent resetKey="login">
          <LoginPage
            onAuthenticated={(current) => void authenticate(current)}
            onNotice={showToast}
          />
        </AsyncContent>
      );
    }
    return (
      <ApplicationShell
        key={session.connection_id}
        session={session}
        dashboard={consoleData?.dashboard ?? {}}
        identity={consoleData?.identity}
        permissions={consoleData?.permissions ?? []}
        activeView={navigationView(route.view)}
        navigate={navigate}
        onNotice={showToast}
        onIdentityChanged={handleIdentityChanged}
        onSessionChanged={handleSessionChanged}
        onLogout={() => void handleLogout()}
        contentKey={route.view}
      >
        <AsyncContent resetKey={route.path}>
          {!consoleData && !sessionError ? <LoadingView /> : null}
          {sessionError ? (
            <ErrorView
              title="无法载入实例概览"
              message={sessionError}
              retry={() => void refresh()}
            />
          ) : null}
          {consoleData ? (
            <Outlet
              context={
                {
                  route,
                  session,
                  consoleData,
                  refreshing: isRefreshing,
                  navigate,
                  refresh,
                  openDialog: setActiveDialog,
                  notify: showToast,
                } satisfies ConsoleRouteContext
              }
            />
          ) : null}
        </AsyncContent>
      </ApplicationShell>
    );
  }

  return (
    <>
      <IconSprite />
      {renderContent()}
      {activeDialog && session ? (
        <AsyncContent
          resetKey={activeDialog.kind}
          onClose={() => {
            setActiveDialog(undefined);
          }}
        >
          <ApplicationDialogHost
            dialog={activeDialog}
            session={session}
            route={route}
            authMode={consoleData?.dashboard.systeminfo?.auth_mode ?? ""}
            navigate={navigate}
            onDialogChange={setActiveDialog}
            onNotice={showToast}
            onRefreshConsole={refresh}
            onReloadPage={reloadPage}
          />
        </AsyncContent>
      ) : null}
      <ToastRegion toast={toast} />
    </>
  );
}

const resolveClasses = createClassNames({
  "toast-region": uiStyles0.toastRegion,
  "loading-state": uiStyles0.loadingState,
  spinner: uiStyles0.spinner,
  "harbor-banner-warning": uiStyles0.harborBannerWarning,
  "harbor-banner-success": uiStyles0.harborBannerSuccess,
  "harbor-banner-info": uiStyles0.harborBannerInfo,
  "harbor-banner-danger": uiStyles0.harborBannerDanger,
  clickable: uiStyles0.clickable,
  "overlay-open": uiStyles0.overlayOpen,
  "log-level-trace": uiStyles0.logLevelTrace,
  "log-level-debug": uiStyles0.logLevelDebug,
  "log-level-log": uiStyles0.logLevelLog,
  "log-level-info": uiStyles0.logLevelInfo,
  "log-level-warn": uiStyles0.logLevelWarn,
  "log-level-error": uiStyles0.logLevelError,
  "log-level-fatal": uiStyles0.logLevelFatal,
});
