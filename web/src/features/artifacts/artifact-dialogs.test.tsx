import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import type { HarborArtifact, ProjectLabel } from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { ArtifactLabelDialog } from "./artifact-label-dialog";
import { CopyArtifactDialog } from "./copy-artifact-dialog";
import { DeleteArtifactsDialog } from "./delete-artifacts-dialog";

const label: ProjectLabel = {
  id: 41,
  name: "生产",
  scope: "p",
};
const artifact: HarborArtifact = {
  digest:
    "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4",
  tags: [{ name: "v3.18.4" }],
  labels: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("artifact dialogs", () => {
  it("attaches labels with the exact Harbor artifact label contract", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const completed = vi.fn();

    render(
      <TestProviders>
        <IconSprite />
        <ArtifactLabelDialog
          mode="attach"
          project="platform"
          repository="platform/gateway"
          artifacts={[artifact]}
          labels={[label]}
          onClose={vi.fn()}
          onCompleted={completed}
        />
      </TestProviders>,
    );

    await user.click(screen.getByRole("button", { name: "添加标签" }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "artifact-labels",
        parameters: {
          project: "platform",
          repository: "platform/gateway",
          reference: artifact.digest,
        },
        method: "POST",
        payload: { id: 41 },
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: expect.any(String) as unknown,
      });
    });
    expect(completed).toHaveBeenCalledWith(0);
  });

  it("copies one artifact from its immutable digest reference", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const copied = vi.fn();

    render(
      <TestProviders>
        <IconSprite />
        <CopyArtifactDialog
          project="platform"
          repository="platform/gateway"
          artifact={artifact}
          onClose={vi.fn()}
          onCopied={copied}
        />
      </TestProviders>,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "目标项目" }),
      "release",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "目标仓库" }),
      "gateway-copy",
    );
    await user.click(screen.getByRole("button", { name: "开始复制" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "artifact-copy",
        parameters: {
          project: "release",
          repository: "gateway-copy",
          from: `platform/gateway@${artifact.digest}`,
        },
        method: "POST",
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: expect.any(String) as unknown,
      });
    });
    expect(copied).toHaveBeenCalledWith("release", "gateway-copy");
  });

  it("requires the legacy DELETE count before batch deletion", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const deleted = vi.fn();
    const second = { ...artifact, digest: "sha256:second" };

    render(
      <TestProviders>
        <IconSprite />
        <DeleteArtifactsDialog
          project="platform"
          repository="platform/gateway"
          artifacts={[artifact, second]}
          onClose={vi.fn()}
          onDeleted={deleted}
        />
      </TestProviders>,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "确认文本" }),
      "DELETE 2",
    );
    await user.click(screen.getByRole("button", { name: "永久删除" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(2);
    });
    expect(mutate).toHaveBeenCalledWith({
      operation: "artifact",
      parameters: {
        project: "platform",
        repository: "platform/gateway",
        reference: artifact.digest,
      },
      method: "DELETE",
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
    expect(deleted).toHaveBeenCalledWith(0);
  });
});
