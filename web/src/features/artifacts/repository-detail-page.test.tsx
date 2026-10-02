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
import type {
  HarborArtifact,
  ProjectLabel,
  ProjectSummary,
  RepositorySummary,
  Session,
} from "../../app/models";
import { IconSprite } from "../../components/icons";
import { RepositoryDetailPage } from "./repository-detail-page";

const session: Session = {
  connection_id: "demo",
  instance_url: "https://harbor.demo.local",
  username: "demo-admin",
  demo: true,
  instance_count: 1,
  expires_at: "2026-08-04T00:00:00Z",
};

const project: ProjectSummary = { project_id: 1, name: "platform" };
const repository: RepositorySummary = {
  id: 101,
  name: "platform/gateway",
  description: "Gateway image",
  artifact_count: 1,
  pull_count: 27,
  update_time: "2026-07-30T08:00:00Z",
};
const label: ProjectLabel = {
  id: 41,
  name: "production",
  color: "#168352",
  scope: "p",
};
const artifact: HarborArtifact = {
  digest:
    "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4",
  size: 1024,
  push_time: "2026-07-30T08:00:00Z",
  pull_time: "2026-07-30T08:00:00Z",
  tags: [{ name: "v1.0.0" }],
  labels: [label],
  extra_attrs: { os: "linux", architecture: "amd64" },
  accessories: [],
  scan_overview: {
    "application/vnd.scanner.adapter.vuln.report.harbor+json": {
      scan_status: "Success",
      severity: "High",
      summary: { total: 2, summary: { High: 2 } },
    },
  },
  annotations: { "org.opencontainers.image.version": "v1.0.0" },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RepositoryDetailPage", () => {
  it("loads the exact artifact contract and preserves filtering, selection, and navigation", async () => {
    const data = vi
      .spyOn(controlApi, "data")
      .mockImplementation((operation) =>
        Promise.resolve(operation === "project" ? project : repository),
      );
    const list = vi
      .spyOn(controlApi, "list")
      .mockImplementation((operation, parameters) => {
        if (operation === "artifacts") {
          return Promise.resolve({
            items: [artifact],
            pagination: { page: 1, page_size: 50, total: 1 },
          });
        }
        const items = parameters?.scope === "p" ? [label] : [];
        return Promise.resolve({
          items,
          pagination: { page: 1, page_size: 100, total: items.length },
        });
      });
    const navigate = vi.fn();
    const artifactAction = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <RepositoryDetailPage
          route={parseHashRoute(
            "#/projects/platform/repositories/platform%2Fgateway/artifacts",
          )}
          session={session}
          refreshing={false}
          navigate={navigate}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onShowPushCommand={vi.fn()}
          onEditRepository={vi.fn()}
          onDeleteRepository={vi.fn()}
          onArtifactAction={artifactAction}
          onNotice={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "gateway" }),
    ).toBeVisible();
    expect(screen.getByText("v1.0.0")).toBeVisible();
    expect(screen.getByText("linux/amd64")).toBeVisible();
    expect(data).toHaveBeenCalledWith(
      "repository",
      { project: "platform", repository: "platform/gateway" },
      expect.any(AbortSignal),
    );
    expect(list).toHaveBeenCalledWith(
      "artifacts",
      {
        project: "platform",
        repository: "platform/gateway",
        page: 1,
        page_size: 50,
        sort: "-push_time",
        q: "",
        with_tag: true,
        with_label: true,
        with_scan_overview: true,
        with_sbom_overview: true,
        with_immutable_status: true,
        with_accessory: true,
      },
      expect.any(AbortSignal),
    );

    fireEvent.change(
      screen.getByRole("searchbox", { name: "按 Tag 搜索制品" }),
      {
        target: { value: "release" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    expect(navigate).toHaveBeenCalledWith(
      "projects/platform/repositories/platform%2Fgateway/artifacts?q=release",
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "选择 v1.0.0" }));
    expect(
      screen.getByText("1", { selector: ".artifact-batch-toolbar strong" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "复制制品" }));
    expect(artifactAction).toHaveBeenCalledWith({
      kind: "copy",
      project: "platform",
      repository: "platform/gateway",
      artifact,
    });

    fireEvent.click(screen.getByText("v1.0.0"));
    expect(navigate).toHaveBeenCalledWith(
      `projects/platform/repositories/platform%2Fgateway/artifacts/${encodeURIComponent(artifact.digest)}`,
    );
  });

  it("loads up to one hundred artifacts per request for client-side scan filtering", async () => {
    vi.spyOn(controlApi, "data").mockImplementation((operation) =>
      Promise.resolve(operation === "project" ? project : repository),
    );
    const failed = {
      ...artifact,
      digest: "sha256:failed",
      tags: [{ name: "failed" }],
      scan_overview: { report: { scan_status: "Failed" } },
    } satisfies HarborArtifact;
    const list = vi.spyOn(controlApi, "list").mockImplementation((operation) =>
      Promise.resolve(
        operation === "artifacts"
          ? {
              items: [artifact, failed],
              pagination: { page: 1, page_size: 100, total: 2 },
            }
          : {
              items: [],
              pagination: { page: 1, page_size: 100, total: 0 },
            },
      ),
    );

    render(
      <LocaleProvider>
        <RepositoryDetailPage
          route={parseHashRoute(
            "#/projects/platform/repositories/platform%2Fgateway/artifacts?scan=error",
          )}
          session={session}
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onShowPushCommand={vi.fn()}
          onEditRepository={vi.fn()}
          onDeleteRepository={vi.fn()}
          onArtifactAction={vi.fn()}
          onNotice={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(await screen.findByText("failed")).toBeVisible();
    expect(screen.queryByText("v1.0.0")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        "artifacts",
        expect.objectContaining({ page: 1, page_size: 100 }),
        expect.any(AbortSignal),
      ),
    );
  });
});
