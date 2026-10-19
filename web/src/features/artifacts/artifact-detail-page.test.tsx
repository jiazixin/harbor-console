import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { controlApi } from "../../app/api-client";
import { parseHashRoute } from "../../app/hash-router";
import { LocaleProvider } from "../../app/locale-context";
import type { HarborArtifact, Session } from "../../app/models";
import { IconSprite } from "../../components/icons";
import type { ArtifactDetailAction } from "./artifact-detail-data";
import { ArtifactDetailPage } from "./artifact-detail-page";

const digest =
  "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4";
const session: Session = {
  connection_id: "demo",
  instance_url: "https://harbor.demo.local",
  username: "demo-admin",
  demo: true,
  instance_count: 1,
  expires_at: "2026-08-04T00:00:00Z",
};
const artifact: HarborArtifact = {
  digest,
  type: "IMAGE",
  size: 2048,
  push_time: "2026-07-28T06:42:00Z",
  tags: [{ id: 1, name: "v3.18.4", immutable: false }],
  labels: [{ id: 41, name: "production", scope: "p" }],
  extra_attrs: { os: "linux", architecture: "amd64" },
  scan_overview: {
    "application/vnd.scanner.adapter.vuln.report.harbor+json": {
      scan_status: "Success",
      severity: "Critical",
      report_id: "demo-report",
      summary: { total: 1, summary: { Critical: 1 } },
    },
  },
  sbom_overview: {},
  accessories: [],
};

function renderPage(hash: string) {
  const navigate = vi.fn();
  const onAction = vi.fn<(action: ArtifactDetailAction) => void>();
  render(
    <LocaleProvider>
      <IconSprite />
      <ArtifactDetailPage
        route={parseHashRoute(hash)}
        session={session}
        refreshing={false}
        navigate={navigate}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onAction={onAction}
        onNotice={vi.fn()}
      />
    </LocaleProvider>,
  );
  return { navigate, onAction };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ArtifactDetailPage", () => {
  it("loads the exact artifact contract and preserves header actions", async () => {
    const data = vi.spyOn(controlApi, "data").mockResolvedValue(artifact);
    const { onAction } = renderPage(
      `#/projects/platform/repositories/platform%2Fgateway/artifacts/${encodeURIComponent(digest)}`,
    );

    expect(
      await screen.findByRole("heading", { name: "v3.18.4" }),
    ).toBeVisible();
    expect(screen.getByText(digest)).toBeVisible();
    expect(
      screen.getAllByText("linux/amd64", { exact: false }).length,
    ).toBeGreaterThan(0);
    expect(data).toHaveBeenCalledWith(
      "artifact",
      {
        project: "platform",
        repository: "platform/gateway",
        reference: digest,
        with_tag: true,
        with_label: true,
        with_scan_overview: true,
        with_sbom_overview: true,
        with_accessory: true,
        with_immutable_status: true,
      },
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("button", { name: "扫描日志" }));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "scan-log",
        project: "platform",
        repository: "platform/gateway",
        reportId: "demo-report",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "复制制品" }));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "copy", artifact }),
    );
  });

  it("loads paginated tags with the exact secondary request", async () => {
    vi.spyOn(controlApi, "data").mockResolvedValue(artifact);
    const list = vi.spyOn(controlApi, "list").mockResolvedValue({
      items: artifact.tags ?? [],
      pagination: { page: 2, page_size: 50, total: 51 },
    });
    const { navigate } = renderPage(
      `#/projects/platform/repositories/platform%2Fgateway/artifacts/${encodeURIComponent(digest)}?tab=tags&page=2`,
    );

    expect(await screen.findByText("Tag 列表")).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "artifact-tags",
      {
        project: "platform",
        repository: "platform/gateway",
        reference: digest,
        page: 2,
        page_size: 50,
        sort: "-push_time",
        with_immutable_status: true,
      },
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole("button", { name: "上一页" }));
    expect(navigate).toHaveBeenCalledWith(
      `projects/platform/repositories/platform%2Fgateway/artifacts/${encodeURIComponent(digest)}?tab=tags`,
    );
  });

  it("loads project and global label choices without failing the whole page", async () => {
    const data = vi
      .spyOn(controlApi, "data")
      .mockImplementation((operation) =>
        Promise.resolve(
          operation === "artifact"
            ? artifact
            : { project_id: 1, name: "platform" },
        ),
      );
    const list = vi
      .spyOn(controlApi, "list")
      .mockImplementation((_operation, parameters) =>
        Promise.resolve({
          items:
            parameters?.scope === "g"
              ? [{ id: 42, name: "global", scope: "g" }]
              : [{ id: 41, name: "production", scope: "p" }],
          pagination: { page: 1, page_size: 100, total: 1 },
        }),
      );
    const { onAction } = renderPage(
      `#/projects/platform/repositories/platform%2Fgateway/artifacts/${encodeURIComponent(digest)}?tab=labels`,
    );

    expect(await screen.findByText("制品标签")).toBeVisible();
    expect(data).toHaveBeenCalledWith(
      "project",
      { project: "platform" },
      expect.any(AbortSignal),
    );
    expect(list).toHaveBeenCalledWith(
      "labels",
      { scope: "g", page: 1, page_size: 100, sort: "name" },
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole("button", { name: "绑定标签" }));
    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "attach-label",
          labels: [expect.objectContaining({ id: 42 })],
        }),
      ),
    );
  });
});
