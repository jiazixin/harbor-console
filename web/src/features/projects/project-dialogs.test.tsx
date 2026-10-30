import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import type { ProjectSummary } from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { first } from "../../test/first";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { CreateProjectDialog } from "./create-project-dialog";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { DeleteProjectsDialog } from "./delete-projects-dialog";
import { ProjectCveExportDialog } from "./project-cve-export-dialog";

const projects: ProjectSummary[] = [
  { project_id: 1, name: "platform" },
  { project_id: 2, name: "commerce" },
];

afterEach(() => vi.restoreAllMocks());

describe("project dialogs", () => {
  it("omits registry_id for a standard project", async () => {
    const user = setupUser();
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
      <TestProviders>
        <IconSprite />
        <CreateProjectDialog onClose={vi.fn()} onCreated={onCreated} />
      </TestProviders>,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "项目名称" }),
      "acceptance-standard",
    );
    await user.click(screen.getByRole("button", { name: "创建项目" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith("acceptance-standard");
    });
    const payload = mutation.mock.calls[0]?.[0].payload;
    expect(mutation).toHaveBeenCalledWith({
      operation: "projects",
      parameters: {},
      method: "POST",
      payload: expect.objectContaining({
        project_name: "acceptance-standard",
      }) as unknown,
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
    expect(payload).not.toHaveProperty("registry_id");
  });

  it("requires the project name for a single project deletion", async () => {
    const user = setupUser();
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();

    render(
      <TestProviders>
        <IconSprite />
        <DeleteProjectDialog
          project={first(projects)}
          onClose={vi.fn()}
          onDeleted={onDeleted}
        />
      </TestProviders>,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "输入资源名称确认" }),
      "wrong",
    );
    await user.click(screen.getByRole("button", { name: "删除项目" }));
    expect(
      await screen.findByText("输入内容与资源名称不一致"),
    ).toBeInTheDocument();
    expect(mutation).not.toHaveBeenCalled();

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "输入资源名称确认" }),
      "platform",
    );
    await user.click(screen.getByRole("button", { name: "删除项目" }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "project",
      parameters: { project: "platform" },
      method: "DELETE",
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("requires the exact batch deletion confirmation and deletes each project", async () => {
    const user = setupUser();
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();

    render(
      <TestProviders>
        <IconSprite />
        <DeleteProjectsDialog
          projects={projects}
          onClose={vi.fn()}
          onDeleted={onDeleted}
        />
      </TestProviders>,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "确认文本" }),
      "wrong",
    );
    await user.click(screen.getByRole("button", { name: "永久删除" }));
    expect(await screen.findByText("请输入 DELETE 2 确认")).toBeInTheDocument();
    expect(mutation).not.toHaveBeenCalled();

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "确认文本" }),
      "DELETE 2",
    );
    await user.click(screen.getByRole("button", { name: "永久删除" }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith(0);
    });
    expect(mutation).toHaveBeenNthCalledWith(1, {
      operation: "project",
      parameters: { project: "platform" },
      method: "DELETE",
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
    expect(mutation).toHaveBeenNthCalledWith(2, {
      operation: "project",
      parameters: { project: "commerce" },
      method: "DELETE",
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("submits a typed CVE export payload for the selected project", async () => {
    const user = setupUser();
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue({ id: 91 });
    const onCreated = vi.fn();

    render(
      <TestProviders>
        <IconSprite />
        <ProjectCveExportDialog
          project={first(projects)}
          onClose={vi.fn()}
          onCreated={onCreated}
        />
      </TestProviders>,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "标签 ID" }),
      "12, 18",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "仓库匹配" }),
      "platform/**",
    );
    await user.click(screen.getByRole("button", { name: "创建导出任务" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(91);
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "cve-export",
      parameters: {},
      method: "POST",
      payload: {
        projects: [1],
        labels: [12, 18],
        repositories: "platform/**",
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
  });
});
