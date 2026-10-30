import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import type {
  HarborPermission,
  ProjectRobot,
  RobotCredential,
} from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { RobotCredentialDialog } from "../../components/robot-credential-dialog";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { DeleteProjectRobotDialog } from "./delete-project-robot-dialog";
import { ProjectRobotDialog } from "./project-robot-dialog";
import { ResetRobotSecretDialog } from "./reset-robot-secret-dialog";

const permissionCandidates: HarborPermission[] = [
  { resource: "repository", action: "pull" },
  { resource: "repository", action: "read" },
  { resource: "repository", action: "push" },
  { resource: "artifact", action: "read" },
  { resource: "artifact", action: "list" },
  { resource: "tag", action: "list" },
  { resource: "label", action: "list" },
];

const robot: ProjectRobot = {
  id: 41,
  name: "robot$platform+ci-release",
  description: "Release pipeline",
  duration: 365,
  disable: false,
  permissions: [
    {
      kind: "project",
      namespace: "platform",
      access: [{ resource: "repository", action: "pull", effect: "allow" }],
    },
  ],
};

function renderDialog(content: React.ReactNode) {
  return render(
    <TestProviders>
      <IconSprite />
      {content}
    </TestProviders>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("project robot dialogs", () => {
  it("preserves the legacy English permission copy and creates an account", async () => {
    const user = setupUser();
    window.localStorage.setItem("harbor-console-language", "en-US");
    const credential: RobotCredential = {
      id: 52,
      name: "robot$platform+release",
      secret: "secret-value",
    };
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(credential);
    const onCreated = vi.fn();

    renderDialog(
      <ProjectRobotDialog
        project="platform"
        permissionCandidates={permissionCandidates}
        onClose={vi.fn()}
        onCreated={onCreated}
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByText("Expiration (days)")).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Project permissions" }),
    ).toBeVisible();
    expect(screen.getAllByText("View")).toHaveLength(2);
    expect(screen.getByText("Label")).toBeVisible();
    expect(
      screen.getByText(
        "When selected, -1 is sent to Harbor automatically; 0 is not valid.",
      ),
    ).toBeVisible();

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "Account name" }),
      "release",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "Description" }),
      "Release automation",
    );
    await user.click(screen.getByRole("checkbox", { name: "Push" }));
    await user.click(screen.getByRole("checkbox", { name: "Never expires" }));
    await user.click(
      screen.getByRole("checkbox", {
        name: /Disable account.*Keep the configuration but prevent authentication/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(credential);
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "robots",
      parameters: {},
      method: "POST",
      payload: {
        name: "release",
        description: "Release automation",
        level: "project",
        duration: -1,
        disable: true,
        permissions: [
          {
            kind: "project",
            namespace: "platform",
            access: [
              { resource: "repository", action: "pull", effect: "allow" },
              { resource: "repository", action: "read", effect: "allow" },
              { resource: "artifact", action: "read", effect: "allow" },
              { resource: "artifact", action: "list", effect: "allow" },
              { resource: "tag", action: "list", effect: "allow" },
              { resource: "repository", action: "push", effect: "allow" },
            ],
          },
        ],
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "robot",
      parameters: { id: 52 },
      method: "PUT",
      payload: {
        name: "robot$platform+release",
        description: "Release automation",
        level: "project",
        duration: -1,
        disable: true,
        permissions: [
          {
            kind: "project",
            namespace: "platform",
            access: [
              { resource: "repository", action: "pull", effect: "allow" },
              { resource: "repository", action: "read", effect: "allow" },
              { resource: "artifact", action: "read", effect: "allow" },
              { resource: "artifact", action: "list", effect: "allow" },
              { resource: "tag", action: "list", effect: "allow" },
              { resource: "repository", action: "push", effect: "allow" },
            ],
          },
        ],
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
    expect(mutation.mock.invocationCallOrder[0]).toBeLessThan(
      mutation.mock.invocationCallOrder[1] ?? 0,
    );
  });

  it("updates a robot with the editable production fields", async () => {
    const user = setupUser();
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onUpdated = vi.fn();

    renderDialog(
      <ProjectRobotDialog
        project="platform"
        robot={robot}
        permissionCandidates={permissionCandidates}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        onUpdated={onUpdated}
      />,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "描述" }),
      "更新后的流水线",
    );
    const repositoryPermission = screen
      .getByText("镜像仓库")
      .closest("section");
    expect(repositoryPermission).not.toBeNull();
    if (!repositoryPermission)
      throw new Error("repository permission is missing");
    await user.click(
      within(repositoryPermission).getByRole("checkbox", { name: "查看" }),
    );
    await user.click(screen.getByRole("button", { name: "保存账号" }));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "robot",
      parameters: { id: 41 },
      method: "PUT",
      payload: {
        name: "robot$platform+ci-release",
        description: "更新后的流水线",
        level: "project",
        duration: 365,
        disable: false,
        permissions: [
          {
            kind: "project",
            namespace: "platform",
            access: [
              { resource: "repository", action: "pull", effect: "allow" },
              { resource: "repository", action: "read", effect: "allow" },
            ],
          },
        ],
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("prevents Harbor project robot names from exceeding the composed account limit", () => {
    renderDialog(
      <ProjectRobotDialog
        project={"p".repeat(255)}
        permissionCandidates={permissionCandidates}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "账号名称" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "创建账号" })).toBeDisabled();
    expect(
      screen.getByText("项目名称过长，Harbor 无法创建项目机器人账号。"),
    ).toBeVisible();
  });

  it("resets a robot secret and returns one-time credentials", async () => {
    const user = setupUser();
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue({ secret: "rotated-secret" });
    const onReset = vi.fn();

    renderDialog(
      <ResetRobotSecretDialog
        robot={robot}
        onClose={vi.fn()}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole("button", { name: "重置密钥" }));

    await waitFor(() => {
      expect(onReset).toHaveBeenCalledWith({
        name: "robot$platform+ci-release",
        secret: "rotated-secret",
      });
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "robot",
      parameters: { id: 41 },
      method: "PATCH",
      payload: {
        secret: "",
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("renders credentials once and deletes the selected account", async () => {
    const user = setupUser();
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const { rerender } = renderDialog(
      <RobotCredentialDialog
        credential={{ name: robot.name, secret: "one-time-secret" }}
        onClose={vi.fn()}
        onCopied={vi.fn()}
      />,
    );

    expect(screen.getByText(robot.name)).toBeVisible();
    expect(screen.getByText("one-time-secret")).toBeVisible();

    rerender(
      <TestProviders>
        <IconSprite />
        <DeleteProjectRobotDialog
          project="platform"
          robot={robot}
          onClose={vi.fn()}
          onDeleted={onDeleted}
        />
      </TestProviders>,
    );
    await user.click(screen.getByRole("button", { name: "删除账号" }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "robot",
      parameters: { id: 41 },
      method: "DELETE",
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });
});
