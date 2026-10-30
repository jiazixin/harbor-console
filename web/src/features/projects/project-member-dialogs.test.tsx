import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import type { ProjectMember } from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { AddProjectMemberDialog } from "./add-project-member-dialog";
import { DeleteProjectMemberDialog } from "./delete-project-member-dialog";
import { EditProjectMemberDialog } from "./edit-project-member-dialog";

const member: ProjectMember = {
  id: 7,
  entity_name: "release-team",
  entity_type: "g",
  role_id: 4,
  role_name: "Maintainer",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("project member dialogs", () => {
  it("searches the Harbor directory and creates a user member", async () => {
    const user = setupUser();
    vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [
        {
          user_id: 9,
          username: "release-user",
          realname: "Release User",
        },
      ],
      pagination: { page: 1, page_size: 20, total: 1 },
    });
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onCreated = vi.fn();

    render(
      <TestProviders>
        <IconSprite />
        <AddProjectMemberDialog
          project="platform"
          existingMembers={[member]}
          authMode="oidc_auth"
          onClose={vi.fn()}
          onCreated={onCreated}
        />
      </TestProviders>,
    );

    await replaceText(
      user,
      screen.getByRole("searchbox", { name: "Harbor 用户名" }),
      "release",
    );
    await user.click(screen.getByRole("button", { name: "搜索目录" }));
    expect(await screen.findByText("release-user")).toBeVisible();
    await user.click(screen.getByRole("radio", { name: /release-user/ }));
    await user.click(screen.getByRole("button", { name: "添加成员" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "project-members",
      parameters: { project: "platform" },
      method: "POST",
      payload: { role_id: 2, member_user: { username: "release-user" } },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
  });

  it("updates only the role field", async () => {
    const user = setupUser();
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onUpdated = vi.fn();
    render(
      <TestProviders>
        <IconSprite />
        <EditProjectMemberDialog
          project="platform"
          member={member}
          onClose={vi.fn()}
          onUpdated={onUpdated}
        />
      </TestProviders>,
    );

    await user.click(screen.getByRole("button", { name: "项目角色" }));
    await user.click(screen.getByRole("option", { name: "项目管理员" }));
    await user.click(screen.getByRole("button", { name: "保存角色" }));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "project-member",
      parameters: { project: "platform", member: 7 },
      method: "PUT",
      payload: { role_id: 1 },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("deletes the selected member after confirmation", async () => {
    const user = setupUser();
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(
      <TestProviders>
        <IconSprite />
        <DeleteProjectMemberDialog
          project="platform"
          member={member}
          onClose={vi.fn()}
          onDeleted={onDeleted}
        />
      </TestProviders>,
    );

    expect(
      screen.getByText("将从项目 platform 中移除 release-team。"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "删除成员" }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "project-member",
      parameters: { project: "platform", member: 7 },
      method: "DELETE",
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });
});
