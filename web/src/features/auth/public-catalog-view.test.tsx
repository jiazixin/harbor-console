import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../app/locale-context";
import type { PublicCatalogState } from "../../app/models";
import {
  createPublicCatalogState,
  normalizePublicCatalogState,
  openPublicCatalogHistory,
  PublicCatalogView,
  restorePublicCatalogState,
} from "./public-catalog-view";

const historyKey = "harborPublicCatalog";
const reloadKey = "harbor-console-public-catalog-reload";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", window.location.href);
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("public catalog state", () => {
  it("normalizes restored state and rejects incomplete navigation levels", () => {
    const normalized = normalizePublicCatalogState({
      url: "https://harbor.example.com/",
      skip_tls_verify: 1,
      level: "artifacts",
      project: "p".repeat(300),
      repository: "r".repeat(1200),
      page: -4,
      page_size: 500,
      query: "q".repeat(300),
      depth: 5.9,
    });

    expect(normalized).toEqual({
      url: "https://harbor.example.com",
      skip_tls_verify: true,
      level: "artifacts",
      project: "p".repeat(255),
      repository: "r".repeat(1024),
      page: 1,
      page_size: 100,
      query: "q".repeat(255),
      depth: 5,
    });
    expect(
      normalizePublicCatalogState({
        url: "file:///tmp/harbor",
        level: "projects",
      }),
    ).toBeUndefined();
    expect(
      normalizePublicCatalogState({
        url: "https://harbor.example.com",
        level: "repositories",
      }),
    ).toBeUndefined();
    expect(
      normalizePublicCatalogState({
        url: "https://harbor.example.com",
        level: "artifacts",
        project: "library",
      }),
    ).toBeUndefined();
  });

  it("prefers history state and restores reload state without adding depth", () => {
    const historyState: PublicCatalogState = {
      ...createPublicCatalogState("https://history.example.com", false),
      query: "history",
      depth: 3,
    };
    const reloadState: PublicCatalogState = {
      ...createPublicCatalogState("https://reload.example.com", true),
      level: "repositories",
      project: "library",
      depth: 9,
    };
    window.history.replaceState({ [historyKey]: historyState }, "", "");
    window.sessionStorage.setItem(reloadKey, JSON.stringify(reloadState));

    expect(restorePublicCatalogState()).toEqual(historyState);
    expect(window.sessionStorage.getItem(reloadKey)).toBeNull();

    window.history.replaceState(null, "", "");
    window.sessionStorage.setItem(reloadKey, JSON.stringify(reloadState));
    expect(restorePublicCatalogState()).toEqual({
      ...reloadState,
      depth: 0,
    });
    expect(window.sessionStorage.getItem(reloadKey)).toBeNull();
  });
});

describe("PublicCatalogView", () => {
  it("navigates projects, repositories, and artifacts using anonymous APIs", async () => {
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.endsWith("/projects")) {
        return Promise.resolve(
          jsonResponse({
            items: [{ project_id: 1, name: "library", owner_name: "admin" }],
            pagination: { page: 1, page_size: 20, total: 1 },
          }),
        );
      }
      if (url.endsWith("/repositories")) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: 2,
                name: "library/alpine",
                artifact_count: 1,
                pull_count: 9,
              },
            ],
            pagination: { page: 1, page_size: 20, total: 1 },
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({
          items: [
            {
              id: 3,
              digest: `sha256:${"a".repeat(64)}`,
              size: 4096,
              tags: [{ id: 4, name: "latest" }],
            },
          ],
          pagination: { page: 1, page_size: 20, total: 1 },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const initial = createPublicCatalogState(
      "https://harbor.example.com",
      false,
    );
    openPublicCatalogHistory(initial);
    render(
      <LocaleProvider>
        <PublicCatalogView
          initialCatalog={initial}
          onClose={vi.fn()}
          onNotice={vi.fn()}
        />
      </LocaleProvider>,
    );

    const project = await screen.findByText("library", { exact: true });
    const projectRow = project.closest("tr");
    expect(projectRow).not.toBeNull();
    if (projectRow) fireEvent.click(projectRow);
    expect(
      await screen.findByRole("heading", { name: "library" }),
    ).toBeInTheDocument();

    const repository = await screen.findByText("alpine", { exact: true });
    const repositoryRow = repository.closest("tr");
    expect(repositoryRow).not.toBeNull();
    if (repositoryRow) fireEvent.click(repositoryRow);
    expect(
      await screen.findByRole("heading", { name: "alpine" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("latest")).toBeInTheDocument();
    expect(
      screen.queryByRole("searchbox", { name: "搜索镜像仓库" }),
    ).not.toBeInTheDocument();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(
      fetchMock.mock.calls.map(([input]) =>
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      ),
    ).toEqual([
      "/api/public/projects",
      "/api/public/repositories",
      "/api/public/artifacts",
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ method: "POST" });
      expect(init?.credentials).toBe("omit");
    }

    fireEvent(window, new Event("beforeunload"));
    expect(
      JSON.parse(window.sessionStorage.getItem(reloadKey) ?? "null"),
    ).toMatchObject({
      level: "artifacts",
      project: "library",
      repository: "library/alpine",
      depth: 3,
    });
  });

  it("restores a normalized popstate and closes when history leaves catalog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(() =>
        Promise.resolve(
          jsonResponse({
            items: [],
            pagination: { page: 1, page_size: 20, total: 0 },
          }),
        ),
      ),
    );
    const initial = createPublicCatalogState(
      "https://harbor.example.com",
      false,
    );
    const onClose = vi.fn();
    openPublicCatalogHistory(initial);
    render(
      <LocaleProvider>
        <PublicCatalogView
          initialCatalog={initial}
          onClose={onClose}
          onNotice={vi.fn()}
        />
      </LocaleProvider>,
    );
    await screen.findByRole("heading", { name: "没有公开项目" });

    const restored: PublicCatalogState = {
      ...initial,
      level: "repositories",
      project: "restored-project",
      query: "restored-query",
      depth: 2,
    };
    window.dispatchEvent(
      new PopStateEvent("popstate", {
        state: { [historyKey]: restored },
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "restored-project" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "搜索镜像仓库" })).toHaveValue(
      "restored-query",
    );

    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledWith(
      expect.objectContaining({ project: "restored-project" }),
    );
  });
});
