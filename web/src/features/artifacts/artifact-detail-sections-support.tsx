import { useLocale } from "../../app/locale-context";
import type { HarborArtifact, ProjectLabel } from "../../app/models";
import { ColorSwatch } from "../../components/color-swatch";
import { type IconName } from "../../components/icons-support";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

import styles from "./artifacts.module.css";

export type ArtifactDetailTab =
  | "accessories"
  | "build"
  | "dependencies"
  | "files"
  | "labels"
  | "license"
  | "overview"
  | "readme"
  | "sbom"
  | "tags"
  | "values"
  | "vulnerabilities";

export const artifactAdditionTabs: Record<
  Exclude<
    ArtifactDetailTab,
    "accessories" | "labels" | "overview" | "tags" | "vulnerabilities"
  >,
  { addition: string; icon: IconName; label: string }
> = {
  sbom: { addition: "sbom", label: "SBOM", icon: "shield" },
  license: { addition: "license", label: "许可证", icon: "check" },
  files: { addition: "files", label: "文件", icon: "database" },
  build: { addition: "build_history", label: "构建历史", icon: "history" },
  dependencies: { addition: "dependencies", label: "依赖", icon: "package" },
  readme: { addition: "readme.md", label: "README", icon: "terminal" },
  values: { addition: "values.yaml", label: "Values", icon: "settings" },
};

// Harbor lists the additions an artifact supports in addition_links; an image
// index, for example, has none, and requesting one returns HTTP 400.
export function artifactHasAddition(
  artifact: HarborArtifact,
  tab: keyof typeof artifactAdditionTabs,
): boolean {
  return Boolean(artifact.addition_links?.[artifactAdditionTabs[tab].addition]);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function recordArray(value: unknown): Record<string, unknown>[] {
  return arrayValue(value).filter(isRecord);
}

type LabelChipProps = { label: ProjectLabel };

export function LabelChip({ label }: LabelChipProps) {
  const { t } = useLocale();
  const name = t(label.name);
  return (
    <span className={resolveClasses(styles.artifactLabelChip)}>
      <ColorSwatch
        className={resolveClasses(styles.artifactLabelSwatch)}
        color={label.color}
      />
      <span title={name}>{name}</span>
    </span>
  );
}

export function normalizedAddition(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const text = raw.trim();
  if (
    (text.startsWith("{") && text.endsWith("}")) ||
    (text.startsWith("[") && text.endsWith("]"))
  ) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

export function artifactAdditionText(raw: unknown): string {
  const value = normalizedAddition(raw);
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

export function artifactAccessoryTypeLabel(value: string | undefined): string {
  const type = value?.toLowerCase() ?? "";
  if (type.includes("cosign") || type.includes("notation")) return "制品签名";
  if (type.includes("sbom")) return "软件物料清单";
  if (type.includes("attestation")) return "证明材料";
  return "关联制品";
}

const resolveClasses = createClassNames({
  "harbor-banner-warning": uiStyles0.harborBannerWarning,
  "harbor-banner-success": uiStyles0.harborBannerSuccess,
  "harbor-banner-info": uiStyles0.harborBannerInfo,
  "harbor-banner-danger": uiStyles0.harborBannerDanger,
  clickable: uiStyles0.clickable,
  "overlay-open": uiStyles0.overlayOpen,
  "log-level-trace": uiStyles0.logLevelTrace,
  "log-level-debug": uiStyles0.logLevelDebug,
  "log-level-log": uiStyles0.logLevelLog,
  "log-level-info": uiStyles0.logLevelInfo,
  "log-level-warn": uiStyles0.logLevelWarn,
  "log-level-error": uiStyles0.logLevelError,
  "log-level-fatal": uiStyles0.logLevelFatal,
});
