import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ApiError, dashboardApi, identityApi, sessionApi } from "./api-client";
import { errorText } from "./errors";
import type {
  Dashboard,
  HarborIdentity,
  HarborPermission,
  Session,
} from "./models";
import { sessionEvents } from "./session-events";

export type ConsoleData = {
  dashboard: Dashboard;
  identity: HarborIdentity;
  permissions: HarborPermission[];
};

const sessionKeys = {
  current: ["session", "current"] as const,
  console: (connection: string | undefined) =>
    ["session", "console", connection] as const,
};

async function loadConsoleData(signal: AbortSignal): Promise<ConsoleData> {
  const [dashboard, identity, permissions] = await Promise.all([
    dashboardApi.load(signal),
    identityApi.current(signal),
    identityApi.permissions(signal),
  ]);
  return { dashboard, identity, permissions };
}

/** Owns the authenticated session and its queries, cancelling old-instance work. */
export function useConsoleSession(navigate: (path: string) => void) {
  const client = useQueryClient();
  const isLoggingOut = useRef(false);
  const sessionQuery = useQuery({
    queryKey: sessionKeys.current,
    queryFn: ({ signal }) => sessionApi.current(signal),
    staleTime: Infinity,
  });
  const session = sessionQuery.data ?? undefined;
  const consoleQuery = useQuery({
    queryKey: sessionKeys.console(session?.connection_id),
    queryFn: ({ signal }) => loadConsoleData(signal),
    enabled: !!session,
    staleTime: 5_000,
  });
  const logoutMutation = useMutation({
    mutationFn: (signal: AbortSignal) => sessionApi.logout(signal),
  });
  const logoutController = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const expire = () => {
      // Cancelling and dropping every instance query prevents another user's
      // cached Harbor data from appearing after the next sign-in.
      void client.cancelQueries();
      client.removeQueries({
        predicate: (query) =>
          query.queryKey[0] !== "session" || query.queryKey[1] !== "current",
      });
      client.setQueryData<Session | null>(sessionKeys.current, null);
    };
    sessionEvents.addEventListener("expired", expire);
    return () => {
      sessionEvents.removeEventListener("expired", expire);
      logoutController.current?.abort();
    };
  }, [client]);

  async function handleAuthenticated(current: Session) {
    logoutController.current?.abort();
    await client.cancelQueries();
    client.removeQueries({
      predicate: (query) =>
        query.queryKey[0] !== "session" || query.queryKey[1] !== "current",
    });
    client.setQueryData(sessionKeys.current, current);
    navigate("overview");
    // The observer renders errors. Authentication itself has already succeeded.
    await client.prefetchQuery({
      queryKey: sessionKeys.console(current.connection_id),
      queryFn: ({ signal }) => loadConsoleData(signal),
    });
  }

  async function handleRefresh() {
    const current = client.getQueryData<Session | null>(sessionKeys.current);
    if (!current || isLoggingOut.current) return;
    const queryKey = sessionKeys.console(current.connection_id);
    if (client.isFetching({ queryKey, exact: true })) return;
    // refetchQueries reports failures to the active query's error state.
    await client.refetchQueries({ queryKey, exact: true });
  }

  async function handleLogout() {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;
    const controller = new AbortController();
    logoutController.current = controller;
    try {
      await client.cancelQueries();
      await logoutMutation.mutateAsync(controller.signal);
      if (controller.signal.aborted) return;
      client.removeQueries({
        predicate: (query) =>
          query.queryKey[0] !== "session" || query.queryKey[1] !== "current",
      });
      client.setQueryData<Session | null>(sessionKeys.current, null);
    } finally {
      isLoggingOut.current = false;
    }
  }

  function updateIdentity(identity: HarborIdentity) {
    const current = client.getQueryData<Session | null>(sessionKeys.current);
    if (!current || current.connection_id !== session?.connection_id) return;
    client.setQueryData<ConsoleData>(
      sessionKeys.console(current.connection_id),
      (previous) => (previous ? { ...previous, identity } : previous),
    );
  }

  const bootstrapError =
    sessionQuery.error instanceof ApiError && sessionQuery.error.status === 401
      ? undefined
      : sessionQuery.error;
  const failure = logoutMutation.error ?? consoleQuery.error ?? bootstrapError;
  return {
    session,
    consoleData: session ? consoleQuery.data : undefined,
    sessionError: failure ? errorText(failure) : "",
    isBooting: sessionQuery.isLoading || (!!session && consoleQuery.isLoading),
    isRefreshing:
      !!session && consoleQuery.isFetching && !consoleQuery.isLoading,
    authenticate: handleAuthenticated,
    refresh: handleRefresh,
    logout: handleLogout,
    updateIdentity,
  };
}
