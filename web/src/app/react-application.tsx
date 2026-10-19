import { lazy, useEffect, useState } from "react";

import { AsyncContent } from "../components/async-content";
import { ErrorView, LoadingView } from "../components/feedback";
import { IconSprite } from "../components/icons";
import { ToastRegion, useToast } from "../components/toast-region";
import { ApplicationShell } from "../layouts/application-shell";
import type { ApplicationDialog } from "./application-dialogs";
import {
  ConsoleRouteContent,
  navigationView,
  viewTitles,
} from "./console-routes";
import { useHashRouter } from "./hash-router";
import { useLocale } from "./locale-context";
import type { HarborIdentity, Session } from "./models";
import { usePageVersions } from "./page-versions";
import { useConsoleSession } from "./use-console-session";

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
  const { route, navigate } = useHashRouter();
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
  } = useConsoleSession(navigate);
  const { toast, showToast } = useToast();
  const { versions, reloadPage } = usePageVersions();
  const [activeDialog, setActiveDialog] = useState<ApplicationDialog>();

  useEffect(() => {
    const pageTitle = session
      ? (viewTitles[route.view] ?? "页面不存在")
      : "连接实例";
    document.title = `${t(pageTitle)} · ${t("Harbor 控制台")}`;
  }, [route.view, session, t]);

  // A dialog belongs to the Harbor connection that opened it.
  useEffect(() => {
    setActiveDialog(undefined);
  }, [session?.connection_id]);

  function handleIdentityChanged(identity: HarborIdentity, message: string) {
    updateIdentity(identity);
    showToast(message);
  }

  async function handleLogout() {
    await logout();
    setActiveDialog(undefined);
  }

  async function handleSessionChanged(current: Session, message: string) {
    setActiveDialog(undefined);
    await authenticate(current);
    showToast(message);
  }

  function renderContent() {
    if (isBooting) {
      return (
        <div className="loading-state">
          <div>
            <span className="spinner" />
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
            <ConsoleRouteContent
              route={route}
              session={session}
              consoleData={consoleData}
              refreshing={isRefreshing}
              versions={versions}
              navigate={navigate}
              refresh={refresh}
              openDialog={setActiveDialog}
              notify={showToast}
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
          onClose={() => setActiveDialog(undefined)}
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
