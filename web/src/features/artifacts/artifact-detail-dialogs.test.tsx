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
import type { HarborArtifact, ProjectLabel } from "../../app/models";
import { IconSprite } from "../../components/icons";
import {
  AddArtifactTagDialog,
  ArtifactScanDialog,
  ArtifactScanLogDialog,
  AttachArtifactLabelDialog,
  DeleteAccessoryArtifactDialog,
  DeleteArtifactDialog,
} from "./artifact-detail-dialogs";

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
    <LocaleProvider>
      <IconSprite />
      {node}
    </LocaleProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("artifact detail dialogs", () => {
  it("submits the selected Harbor scan type", async () => {
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const submitted = vi.fn();
    renderDialog(
      <ArtifactScanDialog
        {...context}
        onClose={vi.fn()}
        onSubmitted={submitted}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /生成 SBOM/ }));
    fireEvent.click(screen.getByRole("button", { name: "提交任务" }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        "artifact-scan",
        {
          project: "platform",
          repository: "platform/gateway",
          reference: artifact.digest,
        },
        "POST",
        { scan_type: "sbom" },
      ),
    );
    expect(submitted).toHaveBeenCalledWith("sbom");
  });

  it("creates a tag with the legacy validation pattern", async () => {
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const created = vi.fn();
    renderDialog(
      <AddArtifactTagDialog
        {...context}
        onClose={vi.fn()}
        onCreated={created}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Tag 名称" }), {
      target: { value: "release-2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建 Tag" }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        "artifact-tags",
        {
          project: "platform",
          repository: "platform/gateway",
          reference: artifact.digest,
        },
        "POST",
        { name: "release-2026" },
      ),
    );
    expect(created).toHaveBeenCalledWith("release-2026");
  });

  it("attaches the selected project or global label", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "绑定标签" }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        "artifact-labels",
        {
          project: "platform",
          repository: "platform/gateway",
          reference: artifact.digest,
        },
        "POST",
        { id: 41 },
      ),
    );
    expect(attached).toHaveBeenCalledWith(label);
  });

  it("requires the exact digest before deleting one artifact", async () => {
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const deleted = vi.fn();
    renderDialog(
      <DeleteArtifactDialog
        {...context}
        onClose={vi.fn()}
        onDeleted={deleted}
      />,
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: "输入资源名称确认" }),
      {
        target: { value: artifact.digest },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "删除制品" }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        "artifact",
        {
          project: "platform",
          repository: "platform/gateway",
          reference: artifact.digest,
        },
        "DELETE",
      ),
    );
    expect(deleted).toHaveBeenCalledOnce();
  });

  it("deletes an accessory through the artifact endpoint", async () => {
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

    fireEvent.change(
      screen.getByRole("textbox", { name: "输入资源名称确认" }),
      {
        target: { value: accessory.digest },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "删除关联制品" }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        "artifact",
        {
          project: "platform",
          repository: "platform/gateway",
          reference: accessory.digest,
        },
        "DELETE",
      ),
    );
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
      expect.any(AbortSignal),
    );
  });

  it("cancels the previous scan log request on refresh and unmount", async () => {
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

    await waitFor(() => expect(data).toHaveBeenCalledTimes(1));
    const firstSignal = data.mock.calls[0]?.[2];
    expect(firstSignal).toBeInstanceOf(AbortSignal);

    fireEvent.click(screen.getByRole("button", { name: "刷新日志" }));
    await waitFor(() => expect(data).toHaveBeenCalledTimes(2));
    const secondSignal = data.mock.calls[1]?.[2];
    expect(firstSignal?.aborted).toBe(true);
    expect(secondSignal?.aborted).toBe(false);

    view.unmount();
    expect(secondSignal?.aborted).toBe(true);
  });
});
