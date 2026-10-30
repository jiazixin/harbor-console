import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import type { RepositorySummary, Session } from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { DeleteRepositoriesDialog } from "./delete-repositories-dialog";
import { PushCommandDialog } from "./push-command-dialog";

const repositories: RepositorySummary[] = [
  { id: 1, name: "platform/api" },
  { id: 2, name: "platform/web" },
];

const session: Session = {
  connection_id: "demo",
  instance_url: "https://harbor.demo.local/",
  username: "demo-admin",
  demo: true,
  instance_count: 1,
  expires_at: "2026-08-04T00:00:00Z",
};

afterEach(() => vi.restoreAllMocks());

describe("repository dialogs", () => {
  it("requires exact confirmation before deleting every selected repository", async () => {
    const user = setupUser();
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(
      <TestProviders>
        <IconSprite />
        <DeleteRepositoriesDialog
          project="platform"
          repositories={repositories}
          onClose={vi.fn()}
          onDeleted={onDeleted}
        />
      </TestProviders>,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "确认文本" }),
      "DELETE",
    );
    await user.click(screen.getByRole("button", { name: "永久删除" }));
    expect(await screen.findByText("请输入 DELETE 2 确认")).toBeVisible();
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
      operation: "repository",
      parameters: { project: "platform", repository: "platform/api" },
      method: "DELETE",
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("generates the same push command sequence from current preferences", () => {
    window.localStorage.setItem(
      "harbor-console-preferences-v1",
      JSON.stringify({ runtime: "podman" }),
    );
    render(
      <TestProviders>
        <IconSprite />
        <PushCommandDialog
          project="platform"
          repository="platform/api"
          session={session}
          onClose={vi.fn()}
          onCopied={vi.fn()}
        />
      </TestProviders>,
    );

    expect(screen.getByText("podman login harbor.demo.local")).toBeVisible();
    expect(
      screen.getByText(
        "podman tag local-image:latest harbor.demo.local/platform/api:latest",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("podman push harbor.demo.local/platform/api:latest"),
    ).toBeVisible();
  });
});
