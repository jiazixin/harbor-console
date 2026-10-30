import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "./api-client";
import { useControlMutation } from "./use-control-mutation";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () => useControlMutation([["projects"], ["repositories"]]),
    { wrapper },
  );
  return { mutate: result.current, invalidate };
}

describe("useControlMutation", () => {
  it("sends the write and refetches the affected queries", async () => {
    const write = vi.spyOn(controlApi, "mutate").mockResolvedValue({ id: 1 });
    const { mutate, invalidate } = setup();

    await expect(
      mutate({
        operation: "project",
        parameters: { id: 1 },
        method: "PUT",
        payload: { public: true },
      }),
    ).resolves.toEqual({ id: 1 });

    expect(write).toHaveBeenCalledWith({
      operation: "project",
      parameters: { id: 1 },
      method: "PUT",
      payload: {
        public: true,
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["repositories"] });
  });

  it("keeps cached queries when the write fails", async () => {
    vi.spyOn(controlApi, "mutate").mockRejectedValue(new Error("denied"));
    const { mutate, invalidate } = setup();

    await expect(
      mutate({ operation: "project", parameters: { id: 1 }, method: "DELETE" }),
    ).rejects.toThrow("denied");
    expect(invalidate).not.toHaveBeenCalled();
  });
});
