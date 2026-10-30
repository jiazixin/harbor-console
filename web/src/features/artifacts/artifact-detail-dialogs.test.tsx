import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import type { HarborArtifact, ProjectLabel } from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { AddArtifactTagDialog } from "./add-artifact-tag-dialog";
import { ArtifactScanDialog } from "./artifact-scan-dialog";
import { ArtifactScanLogDialog } from "./artifact-scan-log-dialog";
import { AttachArtifactLabelDialog } from "./attach-artifact-label-dialog";
import { DeleteAccessoryArtifactDialog } from "./delete-accessory-artifact-dialog";
import { DeleteArtifactDialog } from "./delete-artifact-dialog";

const artifact: HarborArtifact = {
  digest:
    "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4",
  tags: [{ name: "v3.18.4" }],
};
const context = {
  project: "platform",
  repository: "platform/gateway",
  artifact,
};

function renderDialog(node: React.ReactNode) {
  return render(
    <TestProviders>
      <IconSprite />
      {node}
    </TestProviders>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("artifact detail dialogs", () => {
  it("submits the selected Harbor scan type", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const submitted = vi.fn();
    renderDialog(
      <ArtifactScanDialog
        {...context}
        onClose={vi.fn()}
        onSubmitted={submitted}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /生成 SBOM/ }));
    await user.click(screen.getByRole("button", { name: "提交任务" }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "artifact-scan",
        parameters: {
          project: "platform",
          repository: "platform/gateway",
          reference: artifact.digest,
        },
        method: "POST",
        payload: { scan_type: "sbom" },
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: expect.any(String) as unknown,
      });
    });
    expect(submitted).toHaveBeenCalledWith("sbom");
  });

  it("creates a tag with the legacy validation pattern", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const created = vi.fn();
    renderDialog(
      <AddArtifactTagDialog
        {...context}
        onClose={vi.fn()}
        onCreated={created}
      />,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "Tag 名称" }),
      "release-2026",
    );
    await user.click(screen.getByRole("button", { name: "创建 Tag" }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "artifact-tags",
        parameters: {
          project: "platform",
          repository: "platform/gateway",
          reference: artifact.digest,
        },
        method: "POST",
        payload: { name: "release-2026" },
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: expect.any(String) as unknown,
      });
    });
    expect(created).toHaveBeenCalledWith("release-2026");
  });

  it("attaches the selected project or global label", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const label: ProjectLabel = {
      id: 41,
      name: "production",
      scope: "p",
    };
    const attached = vi.fn();
    renderDialog(
      <AttachArtifactLabelDialog
        {...context}
        labels={[label]}
        onClose={vi.fn()}
        onAttached={attached}
      />,
    );

    await user.click(screen.getByRole("button", { name: "绑定标签" }));
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
    expect(attached).toHaveBeenCalledWith(label);
  });

  it("requires the exact digest before deleting one artifact", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const deleted = vi.fn();
    renderDialog(
      <DeleteArtifactDialog
        {...context}
        onClose={vi.fn()}
        onDeleted={deleted}
      />,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "输入资源名称确认" }),
      artifact.digest,
    );
    await user.click(screen.getByRole("button", { name: "删除制品" }));
    await waitFor(() => {
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
    });
    expect(deleted).toHaveBeenCalledOnce();
  });

  it("deletes an accessory through the artifact endpoint", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const deleted = vi.fn();
    const accessory = {
      digest: "sha256:accessory",
      type: "signature.cosign",
    };
    renderDialog(
      <DeleteAccessoryArtifactDialog
        {...context}
        accessory={accessory}
        onClose={vi.fn()}
        onDeleted={deleted}
      />,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "输入资源名称确认" }),
      accessory.digest,
    );
    await user.click(screen.getByRole("button", { name: "删除关联制品" }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "artifact",
        parameters: {
          project: "platform",
          repository: "platform/gateway",
          reference: accessory.digest,
        },
        method: "DELETE",
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: undefined,
      });
    });
    expect(deleted).toHaveBeenCalledOnce();
  });

  it("loads the exact scan report log contract", async () => {
    const data = vi
      .spyOn(controlApi, "data")
      .mockResolvedValue("2026-07-28T06:40:00Z [INFO] completed");
    renderDialog(
      <ArtifactScanLogDialog
        {...context}
        reportId="demo-report"
        onClose={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    expect(await screen.findByText("completed")).toBeVisible();
    expect(data).toHaveBeenCalledWith(
      "artifact-scan-log",
      {
        project: "platform",
        repository: "platform/gateway",
        reference: artifact.digest,
        report: "demo-report",
      },
      expect.any(AbortSignal) as unknown,
    );
  });

  it("cancels the previous scan log request on refresh and unmount", async () => {
    const user = setupUser();
    const data = vi
      .spyOn(controlApi, "data")
      .mockImplementation(() => new Promise(() => undefined));
    const view = renderDialog(
      <ArtifactScanLogDialog
        {...context}
        reportId="demo-report"
        onClose={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(data).toHaveBeenCalledTimes(1);
    });
    const firstSignal = data.mock.calls[0]?.[2];
    expect(firstSignal).toBeInstanceOf(AbortSignal);

    await user.click(screen.getByRole("button", { name: "刷新日志" }));
    await waitFor(() => {
      expect(data).toHaveBeenCalledTimes(2);
    });
    const secondSignal = data.mock.calls[1]?.[2];
    expect(firstSignal?.aborted).toBe(true);
    expect(secondSignal?.aborted).toBe(false);

    view.unmount();
    expect(secondSignal?.aborted).toBe(true);
  });
});
