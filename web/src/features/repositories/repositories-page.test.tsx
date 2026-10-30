import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import { parseConsoleRoute } from "../../app/console-route";
import type {
  ProjectSummary,
  RepositorySummary,
  Session,
} from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { first } from "../../test/first";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { RepositoriesPage } from "./repositories-page";

const session: Session = {
  connection_id: "demo",
  instance_url: "https://harbor.demo.local",
  username: "demo-admin",
  demo: true,
  instance_count: 1,
  expires_at: "2026-08-04T00:00:00Z",
};

const projects: ProjectSummary[] = [
  { project_id: 1, name: "platform" },
  { project_id: 2, name: "sandbox" },
];

const repositories: Record<string, RepositorySummary[]> = {
  platform: [
    {
      id: 4,
      name: "platform/api",
      description: "API image",
      artifact_count: 12,
      pull_count: 18,
      creation_time: "2026-07-20T08:00:00Z",
      update_time: "2026-07-30T08:00:00Z",
    },
  ],
  sandbox: [
    {
      id: 8,
      name: "sandbox/worker",
      artifact_count: 3,
      pull_count: 9,
      creation_time: "2026-07-18T08:00:00Z",
      update_time: "2026-07-29T08:00:00Z",
    },
  ],
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("RepositoriesPage", () => {
  it("loads, filters, sorts, changes view, and opens repositories with legacy contracts", async () => {
    const user = setupUser();
    const list = vi
      .spyOn(controlApi, "list")
      .mockImplementation((_operation, parameters) => {
        const project = String(parameters?.project ?? "");
        const items = repositories[project] ?? [];
        return Promise.resolve({
          items,
          pagination: { page: 1, page_size: 100, total: items.length },
        });
      });
    const navigate = vi.fn();
    const showPushCommand = vi.fn();

    render(
      <TestProviders>
        <IconSprite />
        <RepositoriesPage
          route={parseConsoleRoute("#/repositories")}
          session={session}
          projects={projects}
          refreshing={false}
          navigate={navigate}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onShowPushCommand={showPushCommand}
        />
      </TestProviders>,
    );

    expect(
      await screen.findByRole("heading", { name: "镜像仓库" }),
    ).toBeVisible();
    expect(await screen.findByText("api")).toBeVisible();
    expect(screen.getByText("worker")).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: /制品数/ }),
    ).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("#4")).toBeVisible();
    expect(
      screen
        .getByRole("group", { name: "仓库展示方式" })
        .closest(".hc_6f6adfd6_repositoryAssetToolbarActions"),
    ).not.toBeNull();
    expect(list).toHaveBeenCalledWith(
      "repositories",
      { project: "platform", page: 1, page_size: 100, sort: "name" },
      expect.any(AbortSignal) as unknown,
    );
    expect(list).toHaveBeenCalledWith(
      "repositories",
      { project: "sandbox", page: 1, page_size: 100, sort: "name" },
      expect.any(AbortSignal) as unknown,
    );

    await replaceText(
      user,
      screen.getByRole("searchbox", { name: "搜索项目或仓库" }),
      "worker",
    );
    await user.click(screen.getByRole("button", { name: "项目" }));
    await user.click(screen.getByRole("option", { name: "sandbox" }));
    expect(navigate).toHaveBeenCalledWith("repositories?project=sandbox");
    await user.click(screen.getByRole("button", { name: "筛选" }));
    expect(navigate).toHaveBeenCalledWith("repositories?q=worker");

    await user.click(
      screen.getByRole("button", { name: "按拉取次数降序排序" }),
    );
    expect(navigate).toHaveBeenCalledWith("repositories?sort=-pull_count");

    await user.click(screen.getByRole("button", { name: "卡片视图" }));
    expect(screen.getByRole("button", { name: "卡片视图" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(
      first(screen.getAllByRole("button", { name: "查看推送指引" })),
    );
    expect(showPushCommand).toHaveBeenCalledWith("platform", "platform/api");
    await user.click(screen.getByRole("button", { name: "api" }));
    expect(navigate).toHaveBeenCalledWith(
      "projects/platform/repositories/platform%2Fapi/artifacts",
    );

    await waitFor(() => {
      expect(
        window.localStorage.getItem("harbor-console-preferences-v1"),
      ).toContain('"repositoryView":"card"');
    });
  });

  it("keeps the route geometry stable and advances bounded repository loads without batch barriers", async () => {
    const manyProjects = Array.from({ length: 5 }, (_, index) => ({
      project_id: index + 1,
      name: `project-${String(index + 1)}`,
    }));
    const resolvers = new Map<
      string,
      (value: {
        items: RepositorySummary[];
        pagination: { page: number; page_size: number; total: number };
      }) => void
    >();
    const list = vi
      .spyOn(controlApi, "list")
      .mockImplementation((_operation, parameters) => {
        const project = String(parameters?.project ?? "");
        return new Promise((resolve) => resolvers.set(project, resolve));
      });

    render(
      <TestProviders>
        <IconSprite />
        <RepositoriesPage
          route={parseConsoleRoute("#/repositories")}
          session={session}
          projects={manyProjects}
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onShowPushCommand={vi.fn()}
        />
      </TestProviders>,
    );

    const statistics = screen.getByRole("region", {
      name: "镜像仓库统计",
    });
    expect(statistics).toHaveAttribute("aria-busy", "true");
    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(4);
    });

    resolvers.get("project-1")?.({
      items: [],
      pagination: { page: 1, page_size: 100, total: 0 },
    });
    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(5);
    });

    for (const project of manyProjects.slice(1)) {
      resolvers.get(project.name)?.({
        items: [],
        pagination: { page: 1, page_size: 100, total: 0 },
      });
    }
    await waitFor(() =>
      expect(statistics).toHaveAttribute("aria-busy", "false"),
    );
    expect(statistics).not.toHaveClass("motion-content-enter");
  });

  it("keeps repository statistics and shared table controls English-only", async () => {
    window.localStorage.setItem("harbor-console-language", "en-US");
    vi.spyOn(controlApi, "list").mockImplementation(
      (_operation, parameters) => {
        const project = String(parameters?.project ?? "");
        const items = repositories[project] ?? [];
        return Promise.resolve({
          items,
          pagination: { page: 1, page_size: 100, total: items.length },
        });
      },
    );

    render(
      <TestProviders>
        <IconSprite />
        <RepositoriesPage
          route={parseConsoleRoute("#/repositories")}
          session={session}
          projects={projects}
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onShowPushCommand={vi.fn()}
        />
      </TestProviders>,
    );

    expect(await screen.findByText("2 projects")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Image repository statistics" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Sort by Artifacts ascending" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Items per page" }),
    ).toBeVisible();
  });
});
