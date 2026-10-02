import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardApi, identityApi, sessionApi } from "./api-client";
import type { Dashboard, Session } from "./models";
import { useConsoleSession } from "./use-console-session";

const session: Session = {
  connection_id: "primary",
  instance_url: "https://harbor.example.com",
  username: "admin",
  demo: false,
  instance_count: 2,
  expires_at: "2026-10-03T00:00:00Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.spyOn(sessionApi, "current").mockResolvedValue(session);
  vi.spyOn(sessionApi, "logout").mockResolvedValue(null);
  vi.spyOn(dashboardApi, "load").mockResolvedValue({ mode: "live" });
  vi.spyOn(identityApi, "current").mockResolvedValue({ username: "admin" });
  vi.spyOn(identityApi, "permissions").mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("console session request ownership", () => {
  it("does not restore a logged-out session when an old refresh resolves", async () => {
    const { result } = renderHook(() => useConsoleSession(vi.fn()));
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    const pending = deferred<Dashboard>();
    vi.mocked(dashboardApi.load).mockReturnValueOnce(pending.promise);
    let refresh!: Promise<void>;
    act(() => {
      refresh = result.current.refresh();
    });
    const refreshSignal = vi.mocked(dashboardApi.load).mock.calls.at(-1)?.[0];

    await act(() => result.current.logout());
    expect(refreshSignal?.aborted).toBe(true);
    await act(async () => {
      pending.resolve({ mode: "demo" });
      await refresh;
    });

    expect(result.current.session).toBeUndefined();
    expect(result.current.consoleData).toBeUndefined();
    expect(result.current.isRefreshing).toBe(false);
  });

  it("keeps the new instance when the previous instance refresh finishes later", async () => {
    const { result } = renderHook(() => useConsoleSession(vi.fn()));
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    const pending = deferred<Dashboard>();
    vi.mocked(dashboardApi.load).mockReturnValueOnce(pending.promise);
    let refresh!: Promise<void>;
    act(() => {
      refresh = result.current.refresh();
    });
    const nextSession = { ...session, connection_id: "secondary" };
    vi.mocked(dashboardApi.load).mockResolvedValueOnce({ mode: "demo" });
    await act(() => result.current.authenticate(nextSession));
    await act(async () => {
      pending.resolve({ mode: "live" });
      await refresh;
    });

    expect(result.current.session).toEqual(nextSession);
    expect(result.current.consoleData?.dashboard.mode).toBe("demo");
    expect(result.current.isRefreshing).toBe(false);
  });

  it("starts one refresh for repeated calls before React renders busy state", async () => {
    const { result } = renderHook(() => useConsoleSession(vi.fn()));
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    const pending = deferred<Dashboard>();
    vi.mocked(dashboardApi.load).mockReturnValueOnce(pending.promise);
    let refresh!: Promise<void>;
    act(() => {
      refresh = result.current.refresh();
      void result.current.refresh();
    });
    expect(dashboardApi.load).toHaveBeenCalledTimes(2);
    await act(async () => {
      pending.resolve({});
      await refresh;
    });
    expect(result.current.isRefreshing).toBe(false);
  });

  it("uses the current instance when an old callback requests a refresh", async () => {
    const { result } = renderHook(() => useConsoleSession(vi.fn()));
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    const previousRefresh = result.current.refresh;
    const previousIdentityChange = result.current.updateIdentity;
    const nextSession = { ...session, connection_id: "secondary" };
    vi.mocked(identityApi.current).mockResolvedValue({ username: "operator" });
    await act(() => result.current.authenticate(nextSession));
    await act(previousRefresh);
    act(() => previousIdentityChange({ username: "old-instance-user" }));

    expect(result.current.session).toEqual(nextSession);
    expect(result.current.consoleData?.identity?.username).toBe("operator");
  });

  it("keeps logout in progress when a background callback requests a refresh", async () => {
    const { result } = renderHook(() => useConsoleSession(vi.fn()));
    await waitFor(() => expect(result.current.isBooting).toBe(false));
    const pending = deferred<null>();
    vi.mocked(sessionApi.logout).mockReturnValueOnce(pending.promise);
    let logout!: Promise<void>;
    act(() => {
      logout = result.current.logout();
    });
    const logoutSignal = vi.mocked(sessionApi.logout).mock.calls.at(-1)?.[0];
    await act(() => result.current.refresh());
    expect(dashboardApi.load).toHaveBeenCalledOnce();
    expect(logoutSignal?.aborted).toBe(false);
    await act(async () => {
      pending.resolve(null);
      await logout;
    });
    expect(result.current.session).toBeUndefined();
  });

  it("ignores the cancelled bootstrap during StrictMode's second mount", async () => {
    const first = deferred<Session>();
    const second = deferred<Session>();
    vi.mocked(sessionApi.current)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useConsoleSession(vi.fn()), {
      reactStrictMode: true,
    });

    await act(() => Promise.resolve(first.resolve(session)));
    expect(result.current.isBooting).toBe(true);
    expect(result.current.session).toBeUndefined();
    await act(() => Promise.resolve(second.resolve(session)));
    expect(result.current.isBooting).toBe(false);
    expect(result.current.session).toEqual(session);
    expect(dashboardApi.load).toHaveBeenCalledTimes(1);
  });
});
