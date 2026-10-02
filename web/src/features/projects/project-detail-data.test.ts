import { afterEach, describe, expect, it, vi } from "vitest";

import { controlApi } from "../../app/api-client";
import { loadProjectPage } from "./project-detail-data";
import type { ProjectDetailRoute } from "./project-detail-routing";

const route: ProjectDetailRoute = {
  project: "platform",
  section: "preheat",
  page: 1,
  pageSize: 50,
  query: "",
  sort: "-update_time",
};

function mockProjectRequests(providerError: Error) {
  vi.spyOn(controlApi, "data").mockImplementation((operation) => {
    if (operation === "project") {
      return Promise.resolve({ project_id: 1, name: "platform" });
    }
    if (operation === "project-preheat-providers") {
      return Promise.reject(providerError);
    }
    return Promise.resolve({});
  });
  return vi.spyOn(controlApi, "list").mockImplementation((operation) =>
    Promise.resolve({
      items:
        operation === "preheat-policies" ? [{ id: 7, name: "warm-cache" }] : [],
      pagination: {
        page: 1,
        page_size: 50,
        total: operation === "preheat-policies" ? 1 : 0,
      },
    }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("project section loading", () => {
  it("keeps policies visible when preheat provider discovery fails", async () => {
    mockProjectRequests(new Error("provider unavailable"));
    const result = await loadProjectPage(
      route,
      new AbortController().signal,
      true,
      "en-US",
    );
    expect(result.preheatPolicies).toEqual([{ id: 7, name: "warm-cache" }]);
    expect(result.preheatProviders).toEqual([]);
    expect(result.preheatErrors).toEqual(["provider unavailable"]);
    expect(result.preheatPagination.total).toBe(1);
  });

  it("propagates cancellation rather than displaying it as a partial failure", async () => {
    const cancellation = new DOMException("cancelled", "AbortError");
    mockProjectRequests(cancellation);
    await expect(
      loadProjectPage(route, new AbortController().signal, true, "en-US"),
    ).rejects.toBe(cancellation);
  });

  it("does not request section data without the required permission", async () => {
    const list = mockProjectRequests(new Error("must not request providers"));
    const result = await loadProjectPage(
      route,
      new AbortController().signal,
      false,
      "en-US",
    );
    expect(result.permissionDenied).toBe(true);
    expect(list.mock.calls.map(([operation]) => operation)).toEqual([
      "repositories",
      "current-permissions",
    ]);
    expect(controlApi.data).not.toHaveBeenCalledWith(
      "project-preheat-providers",
      expect.anything(),
      expect.anything(),
    );
  });
});
