import { useEffect, useRef } from "react";
import { useLocale } from "../../app/locale-context";
import type { HarborArtifact, ProjectLabel } from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { ColorSwatch } from "../../components/color-swatch";
import { EmptyState } from "../../components/empty-state";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import { SeverityBadge } from "../../components/severity-badge";
import uiStyles0 from "../../components/shared-ui.module.css";
import { StatusBadge } from "../../components/status-badge";
import { createClassNames } from "../../lib/css/class-names";
import {
  formatBytes,
  formatDate,
  formatNumber,
} from "../../lib/format/formatters";
import {
  artifactPlatformLabel,
  artifactPlatforms,
  artifactScanState,
  artifactSignatureState,
  shortDigest,
} from "./artifact-utils";
import styles from "./artifacts.module.css";
import { artifactPath } from "./repository-artifacts-data";

type ArtifactLabelChipProps = { label: ProjectLabel };

function ArtifactLabelChip({ label }: ArtifactLabelChipProps) {
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

type ArchitectureCellProps = { artifact: HarborArtifact };

function ArchitectureCell({ artifact }: ArchitectureCellProps) {
  const { locale, t } = useLocale();
  const platforms = artifactPlatforms(artifact);
  const [first] = platforms;
  if (!first)
    return <span className={resolveClasses("muted")}>{t("暂无")}</span>;
  if (platforms.length === 1) {
    return (
      <span className={resolveClasses(`badge ${styles.architectureBadge}`)}>
        {artifactPlatformLabel(first)}
      </span>
    );
  }
  const labels = platforms.map(artifactPlatformLabel);
  const remaining = labels.length - 2;
  return (
    <div className={resolveClasses(styles.architectureCell)}>
      <span className={resolveClasses("badge badge-blue")}>
        {locale === "en-US"
          ? `Multi-architecture · ${formatNumber(labels.length, locale)}`
          : `多架构 · ${formatNumber(labels.length, locale)}`}
      </span>
      <small title={labels.join(" · ")}>
        {labels.slice(0, 2).join(" · ")}
        {(() => {
          if (remaining > 0) {
            if (locale === "en-US") {
              return ` · ${formatNumber(remaining, locale)} more`;
            }
            return ` · 另 ${formatNumber(remaining, locale)} 个`;
          }
          return "";
        })()}
      </small>
    </div>
  );
}

type SignatureBadgeProps = { artifact: HarborArtifact };

function SignatureBadge({ artifact }: SignatureBadgeProps) {
  const { t } = useLocale();
  const state = artifactSignatureState(artifact);
  const labels = { signed: "已签名", unsigned: "未签名", unknown: "未知" };
  const classes = {
    signed: "badge-green",
    unsigned: "badge-orange",
    unknown: "",
  };
  return (
    <span className={resolveClasses(`badge ${classes[state]}`.trim())}>
      {t(labels[state])}
    </span>
  );
}

type AnnotationSummaryProps = {
  artifact: HarborArtifact;
  project: string;
  repository: string;
};

function AnnotationSummary({
  artifact,
  project,
  repository,
}: AnnotationSummaryProps) {
  const { locale, t } = useLocale();
  const entries = Object.entries(artifact.annotations ?? {});
  const first = entries[0];
  if (!first) return <span className={resolveClasses("muted")}>-</span>;
  const [key, value] = first;
  return (
    <div className={resolveClasses(styles.artifactAnnotationSummary)}>
      <code title={`${key}: ${value}`}>{`${key}: ${value}`}</code>
      <a href={`#/${artifactPath(project, repository, artifact.digest)}`}>
        {(() => {
          if (entries.length > 1) {
            if (locale === "en-US") {
              return `+${String(entries.length - 1)} view all`;
            }
            return `+${String(entries.length - 1)} ${t("查看全部")}`;
          }
          return t("查看全部");
        })()}
      </a>
    </div>
  );
}

type ArtifactTableProps = {
  artifacts: HarborArtifact[];
  project: string;
  repository: string;
  selected: ReadonlySet<string>;
  busy: boolean;
  navigate: (path: string) => void;
  onToggle: (digest: string) => void;
  onToggleAll: () => void;
};

export function ArtifactTable({
  artifacts,
  project,
  repository,
  selected,
  busy,
  navigate,
  onToggle,
  onToggleAll,
}: ArtifactTableProps) {
  const { locale, t } = useLocale();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedVisible = artifacts.filter((artifact) =>
    selected.has(artifact.digest),
  ).length;
  const allSelected =
    artifacts.length > 0 && selectedVisible === artifacts.length;
  useEffect(() => {
    const input = selectAllRef.current;
    if (!input) return;
    const previous = input.indeterminate;
    input.indeterminate =
      selectedVisible > 0 && selectedVisible < artifacts.length;
    return () => {
      input.indeterminate = previous;
    };
  }, [artifacts.length, selectedVisible]);

  if (!artifacts.length) {
    return (
      <EmptyState
        title="暂无制品"
        description="向该仓库推送镜像后会显示在这里。"
        icon="package"
      />
    );
  }
  return (
    <table className={resolveClasses(styles.artifactSelectTable)}>
      <thead>
        <tr>
          <th className={resolveClasses("selection-cell table-cell-center")}>
            <FormInput
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              disabled={busy}
              aria-label={t("选择当前页全部制品")}
              onChange={onToggleAll}
            />
          </th>
          <th>{t("Tag / 摘要")}</th>
          <th>{t("架构")}</th>
          <th className={resolveClasses("table-cell-center")}>{t("签名")}</th>
          <th>{t("注释")}</th>
          <th className={resolveClasses("table-cell-center")}>
            {t("扫描状态")}
          </th>
          <th className={resolveClasses("table-cell-center")}>
            {t("最高风险")}
          </th>
          <th className={resolveClasses("table-cell-number")}>{t("大小")}</th>
          <th className={resolveClasses("table-cell-time")}>{t("拉取时间")}</th>
          <th className={resolveClasses("table-cell-time")}>{t("推送时间")}</th>
          <th className={resolveClasses("table-cell-center")} />
        </tr>
      </thead>
      <tbody>
        {artifacts.map((artifact) => {
          const scan = artifactScanState(artifact);
          const tags = artifact.tags ?? [];
          const labels = artifact.labels ?? [];
          const firstTag = tags[0]?.name;
          const title = firstTag ? firstTag : shortDigest(artifact.digest);
          const isSelected = selected.has(artifact.digest);
          return (
            <tr
              key={artifact.digest}
              className={resolveClasses(
                `clickable-row${isSelected ? " selected-row" : ""}`,
              )}
              onClick={() => {
                navigate(artifactPath(project, repository, artifact.digest));
              }}
            >
              <td
                className={resolveClasses("selection-cell table-cell-center")}
              >
                <FormInput
                  type="checkbox"
                  checked={isSelected}
                  disabled={busy}
                  aria-label={`${t("选择")} ${title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  onChange={() => {
                    onToggle(artifact.digest);
                  }}
                />
              </td>
              <td>
                <div className={resolveClasses("cell-title")}>
                  <span className={resolveClasses("cell-stack")}>
                    <strong>{title}</strong>
                    <small
                      className={resolveClasses("mono")}
                      title={artifact.digest}
                    >
                      {shortDigest(artifact.digest)}
                      {(() => {
                        if (tags.length > 1) {
                          if (locale === "en-US") {
                            return ` · ${formatNumber(tags.length, locale)} tags`;
                          }
                          return ` · ${formatNumber(tags.length, locale)} 个 Tag`;
                        }
                        return "";
                      })()}
                    </small>
                    {labels.length ? (
                      <span
                        className={resolveClasses(styles.artifactRowLabels)}
                      >
                        {labels.slice(0, 2).map((label) => (
                          <ArtifactLabelChip key={label.id} label={label} />
                        ))}
                        {labels.length > 2 ? (
                          <span className={resolveClasses("badge")}>
                            +{labels.length - 2}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </div>
              </td>
              <td>
                <ArchitectureCell artifact={artifact} />
              </td>
              <td className={resolveClasses("table-cell-center")}>
                <SignatureBadge artifact={artifact} />
              </td>
              <td>
                <AnnotationSummary
                  artifact={artifact}
                  project={project}
                  repository={repository}
                />
              </td>
              <td className={resolveClasses("table-cell-center")}>
                <StatusBadge status={scan.status} />
              </td>
              <td className={resolveClasses("table-cell-center")}>
                <SeverityBadge severity={scan.severity} />
              </td>
              <td className={resolveClasses("table-cell-number")}>
                {formatBytes(artifact.size, locale)}
              </td>
              <td className={resolveClasses("table-cell-time")}>
                {formatDate(artifact.pull_time, {
                  locale: locale,
                  timeZone: displayTimeZone(),
                })}
              </td>
              <td className={resolveClasses("table-cell-time")}>
                {formatDate(artifact.push_time, {
                  locale: locale,
                  timeZone: displayTimeZone(),
                })}
              </td>
              <td className={resolveClasses("table-cell-center")}>
                <Icon name="chevron" />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "status-badge": uiStyles0.statusBadge,
  muted: uiStyles0.muted,
  badge: uiStyles0.badge,
  "badge-blue": uiStyles0.badgeBlue,
  "badge-green": uiStyles0.badgeGreen,
  "badge-orange": uiStyles0.badgeOrange,
  "selection-cell": uiStyles0.selectionCell,
  "table-cell-center": uiStyles0.tableCellCenter,
  "table-cell-number": uiStyles0.tableCellNumber,
  "table-cell-time": uiStyles0.tableCellTime,
  "clickable-row": uiStyles0.clickableRow,
  "selected-row": uiStyles0.selectedRow,
  "cell-title": uiStyles0.cellTitle,
  "cell-stack": uiStyles0.cellStack,
  mono: uiStyles0.mono,
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
