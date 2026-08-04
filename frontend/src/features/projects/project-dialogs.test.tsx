import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { controlApi } from "../../app/api-client";
import { LocaleProvider } from "../../app/locale-context";
import type { ProjectSummary } from "../../app/models";
import { IconSprite } from "../../components/icons";
import {
  CreateProjectDialog,
  DeleteProjectDialog,
  DeleteProjectsDialog,
  ProjectCveExportDialog,
} from "./project-dialogs";

const projects: ProjectSummary[] = [
  { project_id: 1, name: "platform" },
  { project_id: 2, name: "commerce" },
];

afterEach(() => vi.restoreAllMocks());

describe("project dialogs", () => {
  it("omits registry_id for a standard project", async () => {
    vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [],
      pagination: { page: 1, page_size: 100, total: 0 },
    });
    vi.spyOn(controlApi, "data").mockResolvedValue({
      storage_per_project: { value: 10 * 1024 ** 3 },
    });
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onCreated = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <CreateProjectDialog onClose={vi.fn()} onCreated={onCreated} />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "项目名称" }), {
      target: { value: "acceptance-standard" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建项目" }));

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith("acceptance-standard"),
    );
    const payload = mutation.mock.calls[0]?.[3];
    expect(mutation).toHaveBeenCalledWith(
      "projects",
      {},
      "POST",
      expect.objectContaining({ project_name: "acceptance-standard" }),
    );
    expect(payload).not.toHaveProperty("registry_id");
  });

  it("requires the project name for a single project deletion", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <DeleteProjectDialog
          project={projects[0]}
          onClose={vi.fn()}
          onDeleted={onDeleted}
        />
      </LocaleProvider>,
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: "输入资源名称确认" }),
      { target: { value: "wrong" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "删除项目" }));
    expect(
      await screen.findByText("输入内容与资源名称不一致"),
    ).toBeInTheDocument();
    expect(mutation).not.toHaveBeenCalled();

    fireEvent.change(
      screen.getByRole("textbox", { name: "输入资源名称确认" }),
      { target: { value: "platform" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "删除项目" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(mutation).toHaveBeenCalledWith(
      "project",
      { project: "platform" },
      "DELETE",
    );
  });

  it("requires the exact batch deletion confirmation and deletes each project", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <DeleteProjectsDialog
          projects={projects}
          onClose={vi.fn()}
          onDeleted={onDeleted}
        />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "确认文本" }), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "永久删除" }));
    expect(await screen.findByText("请输入 DELETE 2 确认")).toBeInTheDocument();
    expect(mutation).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "确认文本" }), {
      target: { value: "DELETE 2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "永久删除" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(0));
    expect(mutation).toHaveBeenNthCalledWith(
      1,
      "project",
      { project: "platform" },
      "DELETE",
    );
    expect(mutation).toHaveBeenNthCalledWith(
      2,
      "project",
      { project: "commerce" },
      "DELETE",
    );
  });

  it("submits a typed CVE export payload for the selected project", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue({ data: { id: 91 } });
    const onCreated = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectCveExportDialog
          project={projects[0]}
          onClose={vi.fn()}
          onCreated={onCreated}
        />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "标签 ID" }), {
      target: { value: "12, 18" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "仓库匹配" }), {
      target: { value: "platform/**" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建导出任务" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(91));
    expect(mutation).toHaveBeenCalledWith("cve-export", {}, "POST", {
      projects: [1],
      labels: [12, 18],
      repositories: "platform/**",
    });
  });
});
