import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../app/locale-context";
import type {
  ArtifactAccessory,
  ArtifactLabelCollection,
  ArtifactTag,
  HarborArtifact,
} from "../../app/models";
import { IconSprite } from "../../components/icons";
import {
  ArtifactAccessoriesSection,
  ArtifactAdditionSection,
  artifactAdditionText,
  ArtifactLabelsSection,
  ArtifactOverviewSection,
  ArtifactTagsSection,
  ArtifactVulnerabilitiesSection,
} from "./artifact-detail-sections";

const digest =
  "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4";
const artifact: HarborArtifact = {
  digest,
  type: "IMAGE",
  size: 1024,
  tags: [{ name: "v3.18.4" }],
  annotations: { "org.opencontainers.image.version": "v3.18.4" },
  references: [
    {
      child_digest: "sha256:amd64",
      platform: { os: "linux", architecture: "amd64" },
    },
    {
      child_digest: "sha256:arm64",
      platform: { os: "linux", architecture: "arm64", variant: "v8" },
    },
  ],
};

function renderSection(node: React.ReactNode) {
  return render(
    <LocaleProvider>
      <IconSprite />
      {node}
    </LocaleProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("artifact detail sections", () => {
  it("renders legacy pull commands, annotations, and multi-platform actions", () => {
    const copy = vi.fn();
    const openChild = vi.fn();
    renderSection(
      <ArtifactOverviewSection
        artifact={artifact}
        project="platform"
        repository="platform/gateway"
        instanceUrl="https://harbor.demo.local"
        onCopy={copy}
        onOpenChild={openChild}
      />,
    );

    expect(
      screen.getByText(
        "docker pull harbor.demo.local/platform/gateway:v3.18.4",
      ),
    ).toBeVisible();
    expect(screen.getByText("v3.18.4", { selector: ".badge" })).toHaveAttribute(
      "title",
      "v3.18.4",
    );
    expect(screen.getByText("linux/amd64")).toBeVisible();
    expect(screen.getByText("linux/arm64/v8")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "复制" })[0]);
    expect(copy).toHaveBeenCalledWith("v3.18.4");
    fireEvent.click(screen.getAllByRole("button", { name: "打开子清单" })[0]);
    expect(openChild).toHaveBeenCalledWith("sha256:amd64");
  });

  it("keeps tag actions and pagination wired to the shared controls", () => {
    const tag: ArtifactTag = {
      id: 1,
      name: "v3.18.4",
      immutable: false,
      push_time: "2026-07-28T06:42:00Z",
    };
    const add = vi.fn();
    const remove = vi.fn();
    const pageChange = vi.fn();
    renderSection(
      <ArtifactTagsSection
        artifact={artifact}
        project="platform"
        repository="platform/gateway"
        instanceUrl="https://harbor.demo.local"
        collection={{
          items: [tag],
          pagination: { page: 1, page_size: 50, total: 51 },
        }}
        onAdd={add}
        onCopy={vi.fn()}
        onDelete={remove}
        onPageChange={pageChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "添加 Tag" }));
    fireEvent.click(screen.getByRole("button", { name: "删除 Tag" }));
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(add).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(tag);
    expect(pageChange).toHaveBeenCalledWith(2);
  });

  it("renders attached labels and exposes the exact attach and remove actions", () => {
    const label = {
      id: 41,
      name: "production",
      scope: "p",
      color: "#168352",
    } as const;
    const collection: ArtifactLabelCollection = {
      attached: [label],
      available: [label, { id: 42, name: "global", scope: "g" }],
      load_error: "global labels unavailable",
    };
    const attach = vi.fn();
    const remove = vi.fn();
    renderSection(
      <ArtifactLabelsSection
        collection={collection}
        onAttach={attach}
        onRemove={remove}
      />,
    );

    expect(screen.getByText("production")).toBeVisible();
    expect(screen.getByText("production")).toHaveAttribute(
      "title",
      "production",
    );
    expect(screen.getByText(/global labels unavailable/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "绑定标签" }));
    fireEvent.click(screen.getByRole("button", { name: "移除标签" }));
    expect(attach).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(label);
  });

  it("normalizes Harbor scanner reports nested below a media type", () => {
    renderSection(
      <ArtifactVulnerabilitiesSection
        report={{
          "application/vnd.scanner.adapter.vuln.report.harbor+json": {
            scanner: { name: "Trivy" },
            vulnerabilities: [
              {
                id: "CVE-2026-1842",
                severity: "Critical",
                package_name: "libssl3",
                package_version: "3.4.0-r1",
                fixed_version: "3.4.1-r0",
                description: "OpenSSL boundary check",
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText("CVE-2026-1842")).toBeVisible();
    expect(screen.getByText("Trivy", { exact: false })).toBeVisible();
    expect(screen.getByText("libssl3")).toBeVisible();
  });

  it.each([
    [
      "sbom",
      { spdxVersion: "SPDX-2.3", packages: [{ name: "gateway" }] },
      "gateway",
    ],
    ["license", { licenses: [{ id: "Apache-2.0" }] }, "Apache-2.0"],
    ["files", ["/gateway"], "/gateway"],
    [
      "build",
      [{ created_by: "COPY gateway /gateway" }],
      "COPY gateway /gateway",
    ],
    ["dependencies", [{ name: "alpine", version: "3.22.1" }], "alpine"],
    ["readme", "# Gateway", "# Gateway"],
    ["values", "replicaCount: 3", "replicaCount: 3"],
  ] as const)("renders the %s addition shape", (tab, value, expected) => {
    renderSection(
      <ArtifactAdditionSection
        tab={tab}
        value={value}
        onCopy={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    expect(
      screen.getAllByText(expected, { exact: false }).length,
    ).toBeGreaterThan(0);
  });

  it("returns an empty string for an absent addition payload", () => {
    expect(artifactAdditionText(undefined)).toBe("");
  });

  it("keeps accessory open, copy, delete, and pagination callbacks distinct", () => {
    const accessory: ArtifactAccessory = {
      id: 7001,
      digest: "sha256:accessory",
      type: "signature.cosign",
      size: 512,
    };
    const open = vi.fn();
    const copy = vi.fn();
    const remove = vi.fn();
    const pageChange = vi.fn();
    renderSection(
      <ArtifactAccessoriesSection
        collection={{
          items: [accessory],
          pagination: { page: 1, page_size: 50, total: 51 },
        }}
        onOpen={open}
        onCopy={copy}
        onDelete={remove}
        onPageChange={pageChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开关联制品" }));
    fireEvent.click(screen.getByRole("button", { name: "复制摘要" }));
    fireEvent.click(screen.getByRole("button", { name: "删除关联制品" }));
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(open).toHaveBeenCalledWith(accessory);
    expect(copy).toHaveBeenCalledWith(accessory.digest);
    expect(remove).toHaveBeenCalledWith(accessory);
    expect(pageChange).toHaveBeenCalledWith(2);
  });
});
