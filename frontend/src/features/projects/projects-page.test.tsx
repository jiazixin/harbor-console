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
import type { ProjectSummary, Session } from "../../app/models";
import { IconSprite } from "../../components/icons";
import { ProjectsPage } from "./projects-page";

const session: Session = {
  connection_id: "demo",
  instance_url: "https://harbor.demo.local",
  username: "demo-admin",
  demo: true,
  instance_count: 1,
  expires_at: "2026-08-04T00:00:00Z",
};

const projects: ProjectSummary[] = [
  {
    project_id: 2,
    name: "commerce",
    owner_name: "demo-admin",
    repo_count: 18,
    artifact_count: 40,
    creation_time: "2025-12-03T03:12:00Z",
    update_time: "2026-07-28T05:09:00Z",
    metadata: {
      public: "false",
      auto_scan: "true",
      prevent_vul: "true",
      severity: "critical",
    },
  },
  {
    project_id: 1,
    name: "platform",
    owner_name: "demo-admin",
    repo_count: 24,
    artifact_count: 80,
    creation_time: "2025-11-18T08:20:00Z",
    metadata: {
      public: "true",
      auto_scan: "true",
      prevent_vul: "false",
    },
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ProjectsPage", () => {
  it("preserves project list behavior for selection, sorting, and filtering", async () => {
    const list = vi.spyOn(controlApi, "list").mockResolvedValue({
      items: projects,
      pagination: { page: 1, page_size: 50, total: projects.length },
    });
    const navigate = vi.fn();
    const deleteProjects = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectsPage
          route={parseHashRoute("#/projects")}
          session={session}
          refreshing={false}
          navigate={navigate}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onCreateProject={vi.fn()}
          onDeleteProjects={deleteProjects}
          onExportProjectCve={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(await screen.findByText("commerce")).toBeInTheDocument();
    expect(screen.getByText("commerce")).toHaveAttribute("title", "commerce");
    expect(screen.getByRole("heading", { name: "项目中心" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "按项目降序排序" }),
    ).toBeVisible();
    expect(screen.getByText("demo-admin · #2")).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "projects",
      {
        page: 1,
        page_size: 50,
        sort: "name",
        name: "",
        owner: "",
        public: "",
        with_detail: true,
      },
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "选择 commerce" }));
    const deleteButton = screen.getByRole("button", { name: "删除项目" });
    expect(deleteButton).toBeEnabled();
    fireEvent.click(deleteButton);
    expect(deleteProjects).toHaveBeenCalledWith([projects[0]]);

    fireEvent.click(screen.getByRole("button", { name: "按项目降序排序" }));
    expect(navigate).toHaveBeenCalledWith("projects?sort=-name");

    fireEvent.click(screen.getByRole("button", { name: "按最近更新降序排序" }));
    expect(navigate).toHaveBeenCalledWith("projects?sort=-update_time");

    const projectNameSearch = screen.getByRole("searchbox", {
      name: "按项目名称搜索",
    });
    fireEvent.change(projectNameSearch, { target: { value: "plat" } });
    fireEvent.change(
      screen.getByRole("searchbox", { name: "按项目所有者筛选" }),
      { target: { value: "demo-admin" } },
    );
    const filterForm = projectNameSearch.closest("form");
    expect(filterForm).not.toBeNull();
    if (filterForm) fireEvent.submit(filterForm);
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("projects?q=plat&owner=demo-admin"),
    );
  });

  it("sorts derived columns across the complete set without remounting the table", async () => {
    const list = vi.spyOn(controlApi, "list").mockResolvedValue({
      items: projects,
      pagination: { page: 1, page_size: 100, total: projects.length },
    });

    const { rerender } = render(
      <LocaleProvider>
        <IconSprite />
        <ProjectsPage
          route={parseHashRoute("#/projects?sort=-public")}
          session={session}
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onCreateProject={vi.fn()}
          onDeleteProjects={vi.fn()}
          onExportProjectCve={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole("columnheader", { name: "可见性" }),
    ).toHaveAttribute("aria-sort", "descending");
    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows[1]).toHaveTextContent("platform");
      expect(rows[2]).toHaveTextContent("commerce");
    });
    expect(
      screen.getByRole("button", { name: "按自动扫描降序排序" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "按漏洞阻止降序排序" }),
    ).toBeVisible();

    const table = screen.getByRole("table");
    const requestCount = list.mock.calls.length;
    rerender(
      <LocaleProvider>
        <IconSprite />
        <ProjectsPage
          route={parseHashRoute("#/projects?sort=-repo_count")}
          session={session}
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onCreateProject={vi.fn()}
          onDeleteProjects={vi.fn()}
          onExportProjectCve={vi.fn()}
        />
      </LocaleProvider>,
    );

    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows[1]).toHaveTextContent("platform");
      expect(rows[2]).toHaveTextContent("commerce");
    });
    expect(screen.getByRole("table")).toBe(table);
    expect(list).toHaveBeenCalledTimes(requestCount);
    expect(list.mock.calls).not.toContainEqual([
      "projects",
      expect.objectContaining({ sort: "-repo_count" }),
      expect.any(AbortSignal),
    ]);
  });
});
