import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { controlApi } from "../../app/api-client";
import { LocaleProvider } from "../../app/locale-context";
import type { RepositorySummary, Session } from "../../app/models";
import { IconSprite } from "../../components/icons";
import {
  DeleteRepositoriesDialog,
  PushCommandDialog,
} from "./repository-dialogs";

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
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(
      <LocaleProvider>
        <IconSprite />
        <DeleteRepositoriesDialog
          project="platform"
          repositories={repositories}
          onClose={vi.fn()}
          onDeleted={onDeleted}
        />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "确认文本" }), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "永久删除" }));
    expect(await screen.findByText("请输入 DELETE 2 确认")).toBeVisible();
    expect(mutation).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "确认文本" }), {
      target: { value: "DELETE 2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "永久删除" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(0));
    expect(mutation).toHaveBeenNthCalledWith(
      1,
      "repository",
      { project: "platform", repository: "platform/api" },
      "DELETE",
    );
  });

  it("generates the same push command sequence from current preferences", () => {
    window.localStorage.setItem(
      "harbor-console-preferences-v1",
      JSON.stringify({ runtime: "podman" }),
    );
    render(
      <LocaleProvider>
        <IconSprite />
        <PushCommandDialog
          project="platform"
          repository="platform/api"
          session={session}
          onClose={vi.fn()}
          onCopied={vi.fn()}
        />
      </LocaleProvider>,
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
