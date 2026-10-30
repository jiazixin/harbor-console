import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api", () => {
  it("rejects a successful HTML response and keeps its request ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("<html>oops</html>", {
            headers: {
              "Content-Type": "text/html",
              "X-Request-ID": "req-html",
            },
          }),
        ),
      ),
    );
    await expect(api<unknown>("/api/sessions/current")).rejects.toMatchObject({
      code: "invalid_response",
      requestId: "req-html",
    });
  });
  it("never retries a non-idempotent POST", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    await expect(
      api<unknown>("/api/sessions", { method: "POST" }),
    ).rejects.toMatchObject({ code: "network_unavailable", canRetry: false });
  });
  it("sends JSON and returns the response body", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(Response.json({ id: 1 })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      api<{ id: number }>("/api/instances", {
        method: "POST",
        body: { url: "https://harbor.test" },
      }),
    ).resolves.toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/instances",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: '{"url":"https://harbor.test"}',
        headers: { "Content-Type": "application/json" },
      }) as unknown,
    );
  });

  it("maps the error envelope, request ID and Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json(
            {
              error: {
                code: "unauthenticated",
                message: "session expired",
                details: { connection: "a" },
              },
            },
            {
              status: 401,
              headers: { "X-Request-ID": "req-1", "Retry-After": "2" },
            },
          ),
        ),
      ),
    );
    const error: unknown = await api("/api/sessions/current").catch(
      (failure: unknown) => failure,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: "session expired",
      status: 401,
      code: "unauthenticated",
      requestId: "req-1",
      details: { connection: "a" },
      retryAfterMs: 2000,
    });
  });

  it("maps network failures and keeps a caller's cancel native", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    await expect(api("/api/sessions/current")).rejects.toMatchObject({
      status: 0,
      code: "network_unavailable",
    });
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new DOMException("aborted", "AbortError"))),
    );
    await expect(
      api("/api/sessions/current", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("maps a timed-out request to the timeout code", async () => {
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(
      AbortSignal.abort(new DOMException("timed out", "TimeoutError")),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.reject(new DOMException("timed out", "TimeoutError")),
      ),
    );
    await expect(api("/api/sessions/current")).rejects.toMatchObject({
      status: 0,
      code: "timeout",
    });
  });
});
