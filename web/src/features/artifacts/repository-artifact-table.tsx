import { useEffect, useRef } from "react";

import { formatBytes, formatDate, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type { HarborArtifact, ProjectLabel } from "../../app/models";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icons";
import { SeverityBadge, StatusBadge } from "../../components/status-badge";
import {
  artifactPlatformLabel,
  artifactPlatforms,
  artifactScanState,
  artifactSignatureState,
  shortDigest,
} from "./artifact-utils";
import { artifactPath } from "./repository-artifacts-data";

function ArtifactLabelChip({ label }: { label: ProjectLabel }) {
  const { t } = useLocale();
  const name = t(label.name);
  return (
    <span className="artifact-label-chip">
      <span
        className="artifact-label-swatch"
        style={{ backgroundColor: label.color ?? "#8a8a8a" }}
      />
      <span title={name}>{name}</span>
    </span>
  );
}

function ArchitectureCell({ artifact }: { artifact: HarborArtifact }) {
  const { locale, t } = useLocale();
  const platforms = artifactPlatforms(artifact);
  if (!platforms.length) return <span className="muted">{t("暂无")}</span>;
  if (platforms.length === 1) {
    return (
      <span className="badge architecture-badge">
        {artifactPlatformLabel(platforms[0])}
      </span>
    );
  }
  const labels = platforms.map(artifactPlatformLabel);
  const remaining = labels.length - 2;
  return (
    <div className="architecture-cell">
      <span className="badge badge-blue">
        {locale === "en-US"
          ? `Multi-architecture · ${formatNumber(labels.length, locale)}`
          : `多架构 · ${formatNumber(labels.length, locale)}`}
      </span>
      <small title={labels.join(" · ")}>
        {labels.slice(0, 2).join(" · ")}
        {remaining > 0
          ? locale === "en-US"
            ? ` · ${formatNumber(remaining, locale)} more`
            : ` · 另 ${formatNumber(remaining, locale)} 个`
          : ""}
      </small>
    </div>
  );
}

function SignatureBadge({ artifact }: { artifact: HarborArtifact }) {
  const { t } = useLocale();
  const state = artifactSignatureState(artifact);
  const labels = { signed: "已签名", unsigned: "未签名", unknown: "未知" };
  const classes = {
    signed: "badge-green",
    unsigned: "badge-orange",
    unknown: "",
  };
  return (
    <span className={`badge ${classes[state]}`.trim()}>{t(labels[state])}</span>
  );
}

function AnnotationSummary({
  artifact,
  project,
  repository,
}: {
  artifact: HarborArtifact;
  project: string;
  repository: string;
}) {
  const { locale, t } = useLocale();
  const entries = Object.entries(artifact.annotations ?? {});
  if (!entries.length) return <span className="muted">-</span>;
  const [key, value] = entries[0];
  return (
    <div className="artifact-annotation-summary">
      <code title={`${key}: ${value}`}>{`${key}: ${value}`}</code>
      <a href={`#/${artifactPath(project, repository, artifact.digest)}`}>
        {entries.length > 1
          ? locale === "en-US"
            ? `+${String(entries.length - 1)} view all`
            : `+${String(entries.length - 1)} ${t("查看全部")}`
          : t("查看全部")}
      </a>
    </div>
  );
}

export function ArtifactTable({
  artifacts,
  project,
  repository,
  selected,
  busy,
  navigate,
  onToggle,
  onToggleAll,
}: {
  artifacts: HarborArtifact[];
  project: string;
  repository: string;
  selected: ReadonlySet<string>;
  busy: boolean;
  navigate: (path: string) => void;
  onToggle: (digest: string) => void;
  onToggleAll: () => void;
}) {
  const { locale, t } = useLocale();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedVisible = artifacts.filter((artifact) =>
    selected.has(artifact.digest),
  ).length;
  const allSelected =
    artifacts.length > 0 && selectedVisible === artifacts.length;
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedVisible > 0 && selectedVisible < artifacts.length;
    }
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
    <table className="artifact-select-table">
      <thead>
        <tr>
          <th className="selection-cell table-cell-center">
            <input
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
          <th className="table-cell-center">{t("签名")}</th>
          <th>{t("注释")}</th>
          <th className="table-cell-center">{t("扫描状态")}</th>
          <th className="table-cell-center">{t("最高风险")}</th>
          <th className="table-cell-number">{t("大小")}</th>
          <th className="table-cell-time">{t("拉取时间")}</th>
          <th className="table-cell-time">{t("推送时间")}</th>
          <th className="table-cell-center" />
        </tr>
      </thead>
      <tbody>
        {artifacts.map((artifact) => {
          const scan = artifactScanState(artifact);
          const tags = artifact.tags ?? [];
          const labels = artifact.labels ?? [];
          const title = tags[0]?.name || shortDigest(artifact.digest);
          const isSelected = selected.has(artifact.digest);
          return (
            <tr
              key={artifact.digest}
              className={`clickable-row${isSelected ? " selected-row" : ""}`}
              onClick={() =>
                navigate(artifactPath(project, repository, artifact.digest))
              }
            >
              <td className="selection-cell table-cell-center">
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={busy}
                  aria-label={`${t("选择")} ${title}`}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => onToggle(artifact.digest)}
                />
              </td>
              <td>
                <div className="cell-title">
                  <span className="cell-stack">
                    <strong>{title}</strong>
                    <small className="mono" title={artifact.digest}>
                      {shortDigest(artifact.digest)}
                      {tags.length > 1
                        ? locale === "en-US"
                          ? ` · ${formatNumber(tags.length, locale)} tags`
                          : ` · ${formatNumber(tags.length, locale)} 个 Tag`
                        : ""}
                    </small>
                    {labels.length ? (
                      <span className="artifact-row-labels">
                        {labels.slice(0, 2).map((label) => (
                          <ArtifactLabelChip key={label.id} label={label} />
                        ))}
                        {labels.length > 2 ? (
                          <span className="badge">+{labels.length - 2}</span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </div>
              </td>
              <td>
                <ArchitectureCell artifact={artifact} />
              </td>
              <td className="table-cell-center">
                <SignatureBadge artifact={artifact} />
              </td>
              <td>
                <AnnotationSummary
                  artifact={artifact}
                  project={project}
                  repository={repository}
                />
              </td>
              <td className="table-cell-center">
                <StatusBadge status={scan.status} />
              </td>
              <td className="table-cell-center">
                <SeverityBadge severity={scan.severity} />
              </td>
              <td className="table-cell-number">
                {formatBytes(artifact.size, locale)}
              </td>
              <td className="table-cell-time">
                {formatDate(artifact.pull_time, locale)}
              </td>
              <td className="table-cell-time">
                {formatDate(artifact.push_time, locale)}
              </td>
              <td className="table-cell-center">
                <Icon name="chevron" />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
