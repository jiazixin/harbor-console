import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { controlApi } from "../../app/api-client";
import { parseHashRoute } from "../../app/hash-router";
import { LocaleProvider } from "../../app/locale-context";
import type {
  ProjectSummary,
  RepositorySummary,
  Session,
} from "../../app/models";
import { IconSprite } from "../../components/icons";
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
      <LocaleProvider>
        <IconSprite />
        <RepositoriesPage
          route={parseHashRoute("#/repositories")}
          session={session}
          projects={projects}
          refreshing={false}
          navigate={navigate}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onShowPushCommand={showPushCommand}
        />
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "镜像资产" }),
    ).toBeVisible();
    expect(await screen.findByText("api")).toBeVisible();
    expect(screen.getByText("worker")).toBeVisible();
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "仓库",
      "项目",
      "制品数",
      "拉取次数",
      "创建时间",
      "最近推送",
      "",
    ]);
    expect(screen.getByText("#4")).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "repositories",
      { project: "platform", page: 1, page_size: 100, sort: "name" },
      expect.any(AbortSignal),
    );
    expect(list).toHaveBeenCalledWith(
      "repositories",
      { project: "sandbox", page: 1, page_size: 100, sort: "name" },
      expect.any(AbortSignal),
    );

    fireEvent.change(
      screen.getByRole("searchbox", { name: "搜索项目或仓库" }),
      { target: { value: "worker" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "项目" }));
    fireEvent.click(screen.getByRole("option", { name: "sandbox" }));
    expect(navigate).toHaveBeenCalledWith("repositories?project=sandbox");
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    expect(navigate).toHaveBeenCalledWith("repositories?q=worker");

    fireEvent.click(screen.getByRole("button", { name: "排序" }));
    fireEvent.click(screen.getByRole("option", { name: "拉取最多" }));
    expect(navigate).toHaveBeenCalledWith("repositories?sort=-pull_count");

    fireEvent.click(screen.getByRole("button", { name: "卡片视图" }));
    expect(screen.getByRole("button", { name: "卡片视图" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getAllByRole("button", { name: "查看推送指引" })[0]);
    expect(showPushCommand).toHaveBeenCalledWith("platform", "platform/api");
    fireEvent.click(screen.getByRole("button", { name: "api" }));
    expect(navigate).toHaveBeenCalledWith(
      "projects/platform/repositories/platform%2Fapi/artifacts",
    );

    await waitFor(() =>
      expect(
        window.localStorage.getItem("harbor-console-preferences-v1"),
      ).toContain('"repositoryView":"card"'),
    );
  });

  it("keeps repository statistics and toolbar controls English-only", async () => {
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
      <LocaleProvider>
        <IconSprite />
        <RepositoriesPage
          route={parseHashRoute("#/repositories")}
          session={session}
          projects={projects}
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onShowPushCommand={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(await screen.findByText("2 projects")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Image asset statistics" }),
    ).toBeVisible();
    expect(screen.getByText("Sort")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sort" })).toBeVisible();
  });
});
