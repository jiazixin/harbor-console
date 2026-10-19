import type {
  ArtifactPlatform,
  ArtifactReference,
  ArtifactVulnerabilityCounts,
  HarborArtifact,
  Locale,
} from "../../app/models";

export type ArtifactScanState = {
  status: string;
  severity: string;
  reportId: string;
  scanner: string;
  mediaType: string;
  counts: ArtifactVulnerabilityCounts;
  total: number;
};

export type NormalizedArtifactPlatform = {
  os: string;
  architecture: string;
  variant: string;
  osVersion: string;
  osFeatures: string[];
  digest: string;
};

function finiteNumber(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function platformString(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function normalizePlatform(value: ArtifactPlatform | undefined) {
  return {
    os: platformString(value?.os),
    architecture: platformString(value?.architecture),
    variant: platformString(value?.variant),
    osVersion: platformString(value?.["os.version"] ?? value?.os_version),
    osFeatures: (value?.["os.features"] ?? value?.os_features ?? [])
      .map(platformString)
      .filter(Boolean),
  };
}

export function repositoryDisplayName(
  project: string,
  repository: string,
): string {
  const prefix = `${project}/`;
  return repository.startsWith(prefix)
    ? repository.slice(prefix.length)
    : repository;
}

export function shortDigest(value: string): string {
  return value.length > 22
    ? `${value.slice(0, 15)}…${value.slice(-7)}`
    : value || "暂无摘要";
}

export function artifactScanState(
  artifact: HarborArtifact,
  scanType: "sbom" | "vulnerability" = "vulnerability",
): ArtifactScanState {
  const source =
    scanType === "sbom" ? artifact.sbom_overview : artifact.scan_overview;
  const entries = Object.entries(source ?? {});
  const matching = entries.find(([mediaType]) =>
    scanType === "sbom" ? true : /vulnerability\.report/i.test(mediaType),
  );
  const selected = matching ??
    (scanType === "vulnerability" ? entries[0] : undefined) ?? ["", {}];
  const [mediaType, overview] = selected;
  const summary = overview.summary;
  const rawCounts = summary?.summary;
  const counts = {
    critical: finiteNumber(rawCounts?.Critical ?? rawCounts?.critical),
    high: finiteNumber(rawCounts?.High ?? rawCounts?.high),
    medium: finiteNumber(rawCounts?.Medium ?? rawCounts?.medium),
    low: finiteNumber(rawCounts?.Low ?? rawCounts?.low),
  };
  return {
    status:
      overview.scan_status ?? (entries.length ? "Pending" : "Not Scanned"),
    severity: overview.severity ?? "Unknown",
    reportId: overview.report_id ?? "",
    scanner: overview.scanner ?? "",
    mediaType,
    counts,
    total:
      finiteNumber(summary?.total) ||
      Object.values(counts).reduce((sum, value) => sum + value, 0),
  };
}

// BuildKit stores provenance and SBOM attestations as extra index entries with
// an "unknown/unknown" platform. They are not runnable images, so platform
// counts and lists leave them out, matching the Harbor portal.
export function isAttestationReference(reference: ArtifactReference): boolean {
  return (
    reference.annotations?.["vnd.docker.reference.type"] ===
      "attestation-manifest" ||
    (reference.platform?.os === "unknown" &&
      reference.platform.architecture === "unknown")
  );
}

export function artifactPlatformReferences(
  artifact: HarborArtifact,
): ArtifactReference[] {
  return (artifact.references ?? []).filter(
    (reference) => !isAttestationReference(reference),
  );
}

export function artifactPlatforms(
  artifact: HarborArtifact,
): NormalizedArtifactPlatform[] {
  const references = artifactPlatformReferences(artifact);
  if (references.length) {
    return references.map((reference) => ({
      ...normalizePlatform(reference.platform),
      digest: platformString(reference.child_digest),
    }));
  }
  const fallback = normalizePlatform(artifact.extra_attrs);
  if (!fallback.os && !fallback.architecture && !fallback.variant) return [];
  return [{ ...fallback, digest: artifact.digest }];
}

export function artifactPlatformLabel(
  platform: NormalizedArtifactPlatform,
): string {
  return [platform.os, platform.architecture, platform.variant]
    .filter(Boolean)
    .join("/");
}

export function artifactArchitectureSummary(
  artifact: HarborArtifact,
  locale: Locale = "zh-CN",
): string {
  const platforms = artifactPlatforms(artifact);
  if (!platforms.length) return locale === "en-US" ? "None" : "暂无";
  return platforms.length > 1
    ? locale === "en-US"
      ? `Multi-architecture · ${String(platforms.length)} platforms`
      : `多架构 · ${String(platforms.length)} 个平台`
    : artifactPlatformLabel(platforms[0]);
}

export function fullRepositoryName(
  project: string,
  repository: string,
): string {
  const value = repository.replace(/^\/+/, "");
  return value.startsWith(`${project}/`) ? value : `${project}/${value}`;
}

export function artifactPullCommand({
  instanceHost,
  project,
  repository,
  artifact,
  tag = "",
  digest = "",
  runtime = "docker",
}: {
  instanceHost: string;
  project: string;
  repository: string;
  artifact: HarborArtifact;
  tag?: string;
  digest?: string;
  runtime?: string;
}): string {
  const host = instanceHost.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const repositoryName = fullRepositoryName(project, repository);
  if ((artifact.type ?? "UNKNOWN").toUpperCase() === "CHART") {
    return tag
      ? `helm pull oci://${host}/${repositoryName} --version ${tag}`
      : "Helm OCI artifacts require a version tag; pull by digest is unavailable.";
  }
  const selectedRuntime = ["docker", "nerdctl", "podman"].includes(runtime)
    ? runtime
    : "docker";
  const reference = tag || digest;
  return `${selectedRuntime} pull ${host}/${repositoryName}${tag ? ":" : "@"}${reference}`;
}

export function artifactMatchesScanStatus(
  artifact: HarborArtifact,
  filter: string,
): boolean {
  if (!filter) return true;
  if (filter === "unscanned") {
    return Object.keys(artifact.scan_overview ?? {}).length === 0;
  }
  const status = artifactScanState(artifact).status.toLowerCase();
  return filter === "error"
    ? status === "error" || status === "failed"
    : status === filter;
}

export function artifactSignatureState(
  artifact: HarborArtifact,
): "signed" | "unknown" | "unsigned" {
  if (!artifact.accessories) return "unknown";
  const accessories = artifact.accessories;
  if (
    accessories.some((accessory) =>
      /signature|cosign|notation/i.test(accessory.type ?? ""),
    )
  ) {
    return "signed";
  }
  return "unsigned";
}

/** Scan states that Harbor can still stop. */
const stoppableScanStatuses = new Set([
  "running",
  "pending",
  "queued",
  "scheduled",
  "in_progress",
  "inprogress",
]);

export function isStoppableScanStatus(status: string): boolean {
  return stoppableScanStatuses.has(status.toLowerCase());
}
