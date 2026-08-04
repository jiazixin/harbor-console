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
  ArtifactLabelDialog,
  CopyArtifactDialog,
  DeleteArtifactsDialog,
} from "./artifact-dialogs";

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
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const completed = vi.fn();

    render(
      <LocaleProvider>
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
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加标签" }));
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
    expect(completed).toHaveBeenCalledWith(0);
  });

  it("copies one artifact from its immutable digest reference", async () => {
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const copied = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <CopyArtifactDialog
          project="platform"
          repository="platform/gateway"
          artifact={artifact}
          onClose={vi.fn()}
          onCopied={copied}
        />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "目标项目" }), {
      target: { value: "release" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "目标仓库" }), {
      target: { value: "gateway-copy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "开始复制" }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        "artifact-copy",
        {
          project: "release",
          repository: "gateway-copy",
          from: `platform/gateway@${artifact.digest}`,
        },
        "POST",
      ),
    );
    expect(copied).toHaveBeenCalledWith("release", "gateway-copy");
  });

  it("requires the legacy DELETE count before batch deletion", async () => {
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const deleted = vi.fn();
    const second = { ...artifact, digest: "sha256:second" };

    render(
      <LocaleProvider>
        <IconSprite />
        <DeleteArtifactsDialog
          project="platform"
          repository="platform/gateway"
          artifacts={[artifact, second]}
          onClose={vi.fn()}
          onDeleted={deleted}
        />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "确认文本" }), {
      target: { value: "DELETE 2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "永久删除" }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    expect(mutate).toHaveBeenCalledWith(
      "artifact",
      {
        project: "platform",
        repository: "platform/gateway",
        reference: artifact.digest,
      },
      "DELETE",
    );
    expect(deleted).toHaveBeenCalledWith(0);
  });
});
