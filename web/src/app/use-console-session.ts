import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, dashboardApi, identityApi, sessionApi } from "./api-client";
import type {
  Dashboard,
  HarborIdentity,
  HarborPermission,
  Session,
} from "./models";

type ConsoleData = {
  dashboard: Dashboard;
  identity?: HarborIdentity;
  permissions: HarborPermission[];
};

async function loadConsoleData(signal?: AbortSignal): Promise<ConsoleData> {
  const [dashboard, identity, permissions] = await Promise.all([
    dashboardApi.load(signal),
    identityApi.current(signal).catch(() => undefined),
    identityApi.permissions(signal).catch(() => []),
  ]);
  return { dashboard, identity, permissions };
}

export function useConsoleSession(navigate: (path: string) => void) {
  const [session, setSession] = useState<Session>();
  const [consoleData, setConsoleData] = useState<ConsoleData>();
  const [sessionError, setSessionError] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const activeSession = useRef<Session | undefined>(undefined);
  const refreshRequest = useRef<AbortController | undefined>(undefined);
  const startRequest = useCallback(() => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    refreshRequest.current = undefined;
    setIsRefreshing(false);
    return controller;
  }, []);
  const refresh = useCallback(
    async (currentSession: Session, controller: AbortController) => {
      setSessionError("");
      try {
        const data = await loadConsoleData(controller.signal);
        if (controller.signal.aborted || activeRequest.current !== controller)
          return;
        setConsoleData(data);
        setSession(currentSession);
      } catch (loadError) {
        if (controller.signal.aborted || activeRequest.current !== controller)
          return;
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        if (loadError instanceof ApiError && loadError.status === 401) {
          activeSession.current = undefined;
          setSession(undefined);
          setConsoleData(undefined);
          return;
        }
        setSessionError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      }
    },
    [],
  );

  useEffect(() => {
    const controller = startRequest();
    void sessionApi
      .current(controller.signal)
      .then(async (current) => {
        if (controller.signal.aborted || activeRequest.current !== controller)
          return;
        activeSession.current = current;
        setSession(current);
        await refresh(current, controller);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted || activeRequest.current !== controller)
          return;
        if (!(loadError instanceof ApiError && loadError.status === 401)) {
          setSessionError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && activeRequest.current === controller)
          setIsBooting(false);
      });
    return () => controller.abort();
  }, [refresh, startRequest]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function handleAuthenticated(current: Session) {
    const controller = startRequest();
    activeSession.current = current;
    setSession(current);
    setConsoleData(undefined);
    setSessionError("");
    navigate("overview");
    setIsBooting(false);
    await refresh(current, controller);
  }

  async function handleRefresh() {
    const currentSession = activeSession.current;
    if (!currentSession || refreshRequest.current) return;
    const controller = startRequest();
    refreshRequest.current = controller;
    setIsRefreshing(true);
    await refresh(currentSession, controller);
    if (activeRequest.current === controller && !controller.signal.aborted) {
      refreshRequest.current = undefined;
      setIsRefreshing(false);
    }
  }

  async function handleLogout() {
    const controller = startRequest();
    activeSession.current = undefined;
    await sessionApi.logout(controller.signal).catch(() => null);
    if (controller.signal.aborted || activeRequest.current !== controller)
      return;
    setSession(undefined);
    setConsoleData(undefined);
    setSessionError("");
  }

  function updateIdentity(identity: HarborIdentity) {
    if (
      !session ||
      activeSession.current?.connection_id !== session.connection_id
    )
      return;
    setConsoleData((current) => (current ? { ...current, identity } : current));
  }
  return {
    session,
    consoleData,
    sessionError,
    isBooting,
    isRefreshing,
    authenticate: handleAuthenticated,
    refresh: handleRefresh,
    logout: handleLogout,
    updateIdentity,
  };
}
