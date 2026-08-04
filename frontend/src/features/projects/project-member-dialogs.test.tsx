import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { controlApi } from "../../app/api-client";
import { LocaleProvider } from "../../app/locale-context";
import type { ProjectMember } from "../../app/models";
import { IconSprite } from "../../components/icons";
import {
  AddProjectMemberDialog,
  DeleteProjectMemberDialog,
  EditProjectMemberDialog,
} from "./project-member-dialogs";

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
      <LocaleProvider>
        <IconSprite />
        <AddProjectMemberDialog
          project="platform"
          existingMembers={[member]}
          authMode="oidc_auth"
          onClose={vi.fn()}
          onCreated={onCreated}
        />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Harbor 用户名" }), {
      target: { value: "release" },
    });
    fireEvent.click(screen.getByRole("button", { name: "搜索目录" }));
    expect(await screen.findByText("release-user")).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: /release-user/ }));
    fireEvent.click(screen.getByRole("button", { name: "添加成员" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "project-members",
      { project: "platform" },
      "POST",
      { role_id: 2, member_user: { username: "release-user" } },
    );
  });

  it("updates only the role field", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onUpdated = vi.fn();
    render(
      <LocaleProvider>
        <IconSprite />
        <EditProjectMemberDialog
          project="platform"
          member={member}
          onClose={vi.fn()}
          onUpdated={onUpdated}
        />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "项目角色" }));
    fireEvent.click(screen.getByRole("option", { name: "项目管理员" }));
    fireEvent.click(screen.getByRole("button", { name: "保存角色" }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "project-member",
      { project: "platform", member: 7 },
      "PUT",
      { role_id: 1 },
    );
  });

  it("deletes the selected member after confirmation", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(
      <LocaleProvider>
        <IconSprite />
        <DeleteProjectMemberDialog
          project="platform"
          member={member}
          onClose={vi.fn()}
          onDeleted={onDeleted}
        />
      </LocaleProvider>,
    );

    expect(
      screen.getByText("将从项目 platform 中移除 release-team。"),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "删除成员" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "project-member",
      { project: "platform", member: 7 },
      "DELETE",
    );
  });
});
