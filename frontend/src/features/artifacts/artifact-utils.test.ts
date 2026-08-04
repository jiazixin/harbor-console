import { describe, expect, it } from "vitest";

import type { HarborArtifact } from "../../app/models";
import {
  artifactMatchesScanStatus,
  artifactArchitectureSummary,
  artifactPullCommand,
  artifactPlatformLabel,
  artifactPlatforms,
  artifactScanState,
  artifactSignatureState,
  repositoryDisplayName,
  shortDigest,
} from "./artifact-utils";

const artifact: HarborArtifact = {
  digest:
    "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4",
  scan_overview: {
    "application/vnd.scanner.adapter.vuln.report.harbor+json; version=1.0": {
      scan_status: "Success",
      severity: "High",
      report_id: "report-1",
      summary: {
        total: 6,
        summary: { Critical: 1, High: 2, Medium: 3 },
      },
    },
  },
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
  accessories: [{ digest: "sha256:signature", type: "signature.cosign" }],
};

describe("artifact utilities", () => {
  it("normalizes names, digests, scans, platforms, and signatures", () => {
    expect(repositoryDisplayName("platform", "platform/gateway")).toBe(
      "gateway",
    );
    expect(shortDigest(artifact.digest)).toBe("sha256:41bf0e3b…36c28a4");
    expect(artifactScanState(artifact)).toMatchObject({
      status: "Success",
      severity: "High",
      reportId: "report-1",
      total: 6,
      counts: { critical: 1, high: 2, medium: 3, low: 0 },
    });
    expect(artifactPlatforms(artifact).map(artifactPlatformLabel)).toEqual([
      "linux/amd64",
      "linux/arm64/v8",
    ]);
    expect(artifactSignatureState(artifact)).toBe("signed");
    expect(artifactArchitectureSummary(artifact)).toBe("多架构 · 2 个平台");
    expect(
      artifactPullCommand({
        instanceHost: "https://harbor.demo.local",
        project: "platform",
        repository: "platform/gateway",
        artifact,
        tag: "v1.0.0",
        runtime: "podman",
      }),
    ).toBe("podman pull harbor.demo.local/platform/gateway:v1.0.0");
    expect(artifactSignatureState({ digest: "sha256:unknown" })).toBe(
      "unknown",
    );
    expect(
      artifactSignatureState({ digest: "sha256:unsigned", accessories: [] }),
    ).toBe("unsigned");
  });

  it("matches the legacy scan filter rules", () => {
    expect(artifactMatchesScanStatus(artifact, "success")).toBe(true);
    expect(artifactMatchesScanStatus(artifact, "error")).toBe(false);
    expect(
      artifactMatchesScanStatus({ digest: "sha256:empty" }, "unscanned"),
    ).toBe(true);
    expect(
      artifactMatchesScanStatus(
        {
          digest: "sha256:error",
          scan_overview: { report: { scan_status: "Failed" } },
        },
        "error",
      ),
    ).toBe(true);
  });
});
