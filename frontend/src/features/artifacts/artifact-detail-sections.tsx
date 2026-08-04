import type { ReactNode } from "react";

import {
  formatBytes,
  formatDate,
  formatNumber,
  instanceHost,
} from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  ArtifactAccessory,
  ArtifactLabelCollection,
  ArtifactTag,
  ArtifactVulnerability,
  ArtifactVulnerabilityReport,
  ControlList,
  HarborArtifact,
  ProjectLabel,
} from "../../app/models";
import { loadPreferences } from "../../app/preferences";
import { Pagination } from "../../components/data-table";
import { Icon, type IconName } from "../../components/icons";
import { OverflowText } from "../../components/overflow-text";
import { SeverityBadge } from "../../components/status-badge";
import {
  artifactArchitectureSummary,
  artifactPlatformLabel,
  artifactPlatforms,
  artifactPullCommand,
  artifactSignatureState,
  shortDigest,
} from "./artifact-utils";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function numberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return arrayValue(value).filter(isRecord);
}

function EmptySection({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: IconName;
}) {
  const { t } = useLocale();
  return (
    <div className="empty-state">
      <span className="state-icon">
        <Icon name={icon} />
      </span>
      <h2>{t(title)}</h2>
      <p>{t(description)}</p>
    </div>
  );
}

function DefinitionRow({ label, value }: { label: string; value: ReactNode }) {
  const { t } = useLocale();
  return (
    <div>
      <dt>{t(label)}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function LabelChip({ label }: { label: ProjectLabel }) {
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

export function ArtifactOverviewSection({
  artifact,
  project,
  repository,
  instanceUrl,
  onCopy,
  onOpenChild,
}: {
  artifact: HarborArtifact;
  project: string;
  repository: string;
  instanceUrl: string;
  onCopy: (value: string) => void;
  onOpenChild: (digest: string) => void;
}) {
  const { locale, t } = useLocale();
  const runtime = loadPreferences().runtime;
  const tags = artifact.tags ?? [];
  const pulls = tags.length
    ? tags.map((tag) => ({
        label: tag.name,
        command: artifactPullCommand({
          instanceHost: instanceHost(instanceUrl),
          project,
          repository,
          artifact,
          tag: tag.name,
          runtime,
        }),
      }))
    : [
        {
          label: t("按摘要拉取"),
          command: artifactPullCommand({
            instanceHost: instanceHost(instanceUrl),
            project,
            repository,
            artifact,
            digest: artifact.digest,
            runtime,
          }),
        },
      ];
  const signature = artifactSignatureState(artifact);
  const signatureLabel =
    signature === "signed"
      ? "已签名"
      : signature === "unsigned"
        ? "未签名"
        : "未知";
  const annotations = Object.entries(artifact.annotations ?? {});
  const platforms = artifactPlatforms(artifact);

  return (
    <>
      <div className="detail-columns">
        <section className="panel command-panel">
          <div className="panel-head">
            <div>
              <h2>{t("拉取命令")}</h2>
              <p>
                {t("当前使用")} {runtime}
              </p>
            </div>
            <Icon name="terminal" />
          </div>
          {pulls.map((item) => (
            <div className="command-row" key={item.command}>
              <span className="badge" title={item.label}>
                {item.label}
              </span>
              <code>{item.command}</code>
              <button
                className="icon-button"
                type="button"
                title={t("复制拉取命令")}
                aria-label={t("复制拉取命令")}
                onClick={() => onCopy(item.command)}
              >
                <Icon name="copy" />
              </button>
            </div>
          ))}
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>{t("制品信息")}</h2>
              <p>{artifact.type ?? t("镜像")}</p>
            </div>
          </div>
          <dl className="definition-list">
            <DefinitionRow
              label="媒体类型"
              value={artifact.manifest_media_type ?? artifact.media_type ?? "-"}
            />
            <DefinitionRow
              label="制品大小"
              value={formatBytes(artifact.size, locale)}
            />
            <DefinitionRow
              label="最近拉取"
              value={formatDate(artifact.pull_time, locale)}
            />
            <DefinitionRow
              label="架构"
              value={artifactArchitectureSummary(artifact, locale)}
            />
            <DefinitionRow label="签名" value={t(signatureLabel)} />
          </dl>
        </section>
      </div>
      {annotations.length ? (
        <section className="panel artifact-annotations-panel">
          <div className="panel-head">
            <div>
              <h2>{t("注释")}</h2>
              <p>
                {formatNumber(annotations.length, locale)}{" "}
                {t("项 OCI annotations")}
              </p>
            </div>
          </div>
          <dl className="definition-list artifact-annotations-list">
            {annotations.map(([key, value]) => (
              <div key={key}>
                <dt>
                  <code>{key}</code>
                </dt>
                <dd>
                  <code>{value}</code>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("复制")}
                    aria-label={t("复制")}
                    onClick={() => onCopy(value)}
                  >
                    <Icon name="copy" />
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {platforms.length > 1 ? (
        <section className="panel artifact-platform-panel">
          <div className="panel-head">
            <div>
              <h2>{t("平台与架构")}</h2>
              <p>
                {locale === "en-US"
                  ? `OCI image index returned by Harbor with ${formatNumber(platforms.length, locale)} child manifests`
                  : `Harbor 返回的 OCI 镜像索引，共 ${formatNumber(platforms.length, locale)} 个子清单`}
              </p>
            </div>
            <span className="badge badge-blue">{t("多架构")}</span>
          </div>
          <div className="artifact-platform-list">
            {platforms.map((platform) => {
              const details: string[] = [];
              if (platform.osVersion)
                details.push(`${t("系统版本")} ${platform.osVersion}`);
              if (platform.osFeatures.length)
                details.push(
                  `${t("特性")} ${platform.osFeatures.join(locale === "en-US" ? ", " : "、")}`,
                );
              return (
                <div
                  className="artifact-platform-row"
                  key={platform.digest || artifactPlatformLabel(platform)}
                >
                  <div className="platform-identity">
                    <span className="cell-stack">
                      <strong className="mono">
                        {artifactPlatformLabel(platform)}
                      </strong>
                      <small>{details.join(" · ") || t("OCI 子清单")}</small>
                    </span>
                  </div>
                  <code title={platform.digest}>
                    {platform.digest
                      ? shortDigest(platform.digest)
                      : t("暂无摘要")}
                  </code>
                  {platform.digest ? (
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        type="button"
                        title={t("打开子清单")}
                        aria-label={t("打开子清单")}
                        onClick={() => onOpenChild(platform.digest)}
                      >
                        <Icon name="external" />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        title={t("复制子清单摘要")}
                        aria-label={t("复制子清单摘要")}
                        onClick={() => onCopy(platform.digest)}
                      >
                        <Icon name="copy" />
                      </button>
                    </div>
                  ) : (
                    <span className="platform-action-placeholder" />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}

export function ArtifactTagsSection({
  artifact,
  project,
  repository,
  instanceUrl,
  collection,
  onAdd,
  onCopy,
  onDelete,
  onPageChange,
}: {
  artifact: HarborArtifact;
  project: string;
  repository: string;
  instanceUrl: string;
  collection: ControlList<ArtifactTag>;
  onAdd: () => void;
  onCopy: (value: string) => void;
  onDelete: (tag: ArtifactTag) => void;
  onPageChange: (page: number) => void;
}) {
  const { locale, t } = useLocale();
  const runtime = loadPreferences().runtime;
  return (
    <section className="table-shell">
      <div className="table-toolbar">
        <strong>{t("Tag 列表")}</strong>
        <div className="toolbar-spacer" />
        <button
          className="button button-small button-primary"
          type="button"
          onClick={onAdd}
        >
          <Icon name="plus" />
          <span>{t("添加 Tag")}</span>
        </button>
      </div>
      <div className="table-scroll">
        {collection.items.length ? (
          <table>
            <thead>
              <tr>
                <th>Tag</th>
                <th>{t("不可变")}</th>
                <th className="table-cell-time">{t("推送时间")}</th>
                <th className="table-cell-time">{t("最近拉取")}</th>
                <th className="table-cell-center">{t("拉取命令")}</th>
                <th className="table-cell-center" />
              </tr>
            </thead>
            <tbody>
              {collection.items.map((tag) => {
                const command = artifactPullCommand({
                  instanceHost: instanceHost(instanceUrl),
                  project,
                  repository,
                  artifact,
                  tag: tag.name,
                  runtime,
                });
                return (
                  <tr key={tag.id ?? tag.name}>
                    <td>
                      <div className="cell-title">
                        <OverflowText as="strong">{tag.name}</OverflowText>
                      </div>
                    </td>
                    <td>
                      {tag.immutable ? (
                        <span className="badge badge-orange">
                          {t("不可变")}
                        </span>
                      ) : (
                        <span className="badge">{t("可变")}</span>
                      )}
                    </td>
                    <td className="table-cell-time">
                      {formatDate(tag.push_time, locale)}
                    </td>
                    <td className="table-cell-time">
                      {formatDate(tag.pull_time, locale)}
                    </td>
                    <td className="table-cell-center">
                      <button
                        className="button button-small"
                        type="button"
                        onClick={() => onCopy(command)}
                      >
                        <Icon name="copy" />
                        <span>{t("复制")}</span>
                      </button>
                    </td>
                    <td className="table-cell-center">
                      <button
                        className="icon-button danger-icon"
                        type="button"
                        disabled={tag.immutable}
                        title={t("删除 Tag")}
                        aria-label={t("删除 Tag")}
                        onClick={() => onDelete(tag)}
                      >
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptySection
            title="没有 Tag"
            description="该制品当前只能通过摘要引用。"
            icon="tag"
          />
        )}
      </div>
      <Pagination
        pagination={collection.pagination}
        onPageChange={onPageChange}
      />
    </section>
  );
}

export function ArtifactLabelsSection({
  collection,
  onAttach,
  onRemove,
}: {
  collection: ArtifactLabelCollection;
  onAttach: () => void;
  onRemove: (label: ProjectLabel) => void;
}) {
  const { locale, t } = useLocale();
  return (
    <section className="table-shell artifact-label-panel">
      <div className="table-toolbar">
        <div>
          <strong>{t("制品标签")}</strong>
          <span className="toolbar-caption">
            {formatNumber(collection.attached.length, locale)} {t("个已绑定")}
          </span>
        </div>
        <div className="toolbar-spacer" />
        <button
          className="button button-small button-primary"
          type="button"
          disabled={collection.available.length <= collection.attached.length}
          onClick={onAttach}
        >
          <Icon name="plus" />
          <span>{t("绑定标签")}</span>
        </button>
      </div>
      {collection.load_error ? (
        <div className="warning-banner artifact-inline-warning">
          <Icon name="alert" />
          <span>
            {t("部分标签载入失败")}：{collection.load_error}
          </span>
        </div>
      ) : null}
      {collection.attached.length ? (
        <div className="artifact-label-list">
          {collection.attached.map((label) => (
            <div className="artifact-label-row" key={label.id}>
              <span
                className="label-swatch"
                style={{ backgroundColor: label.color ?? "#8a8a8a" }}
              />
              <span className="cell-stack">
                <OverflowText as="strong">{t(label.name)}</OverflowText>
                <OverflowText as="small">
                  {`${t(label.scope === "g" ? "全局标签" : "项目标签")}${label.description ? ` · ${t(label.description)}` : ""}`}
                </OverflowText>
              </span>
              <button
                className="icon-button danger-icon"
                type="button"
                title={t("移除标签")}
                aria-label={t("移除标签")}
                onClick={() => onRemove(label)}
              >
                <Icon name="x" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptySection
          title="尚未绑定标签"
          description="绑定项目或全局标签后，可快速识别和筛选制品。"
          icon="tag"
        />
      )}
    </section>
  );
}

function normalizeVulnerabilityReport(raw: unknown): {
  items: ArtifactVulnerability[];
  scanner: string;
} {
  let report = isRecord(raw) ? raw : {};
  if (!Array.isArray(report.vulnerabilities)) {
    const nested = Object.values(report).find(
      (value) => isRecord(value) && Array.isArray(value.vulnerabilities),
    );
    if (isRecord(nested)) report = nested;
  }
  const scanner = isRecord(report.scanner)
    ? stringValue(report.scanner.name)
    : "";
  return {
    items: recordArray(report.vulnerabilities),
    scanner: scanner || "Harbor 扫描器",
  };
}

export function ArtifactVulnerabilitiesSection({
  report,
  loadError,
}: {
  report?: ArtifactVulnerabilityReport;
  loadError?: string;
}) {
  const { locale, t } = useLocale();
  if (loadError)
    return (
      <section className="panel">
        <EmptySection
          title="漏洞报告不可用"
          description={loadError}
          icon="alert"
        />
      </section>
    );
  const normalized = normalizeVulnerabilityReport(report);
  if (!normalized.items.length)
    return (
      <section className="panel">
        <EmptySection
          title="没有漏洞记录"
          description="扫描报告未包含漏洞。"
          icon="shield"
        />
      </section>
    );
  return (
    <section className="table-shell">
      <div className="table-toolbar">
        <strong>{t("漏洞明细")}</strong>
        <div className="toolbar-spacer" />
        <span className="muted">
          {formatNumber(normalized.items.length, locale)} {t("条")} ·{" "}
          {normalized.scanner}
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("漏洞编号")}</th>
              <th>{t("风险")}</th>
              <th>{t("软件包")}</th>
              <th>{t("当前版本")}</th>
              <th>{t("修复版本")}</th>
              <th>{t("说明")}</th>
            </tr>
          </thead>
          <tbody>
            {normalized.items.map((item, index) => (
              <tr key={item.id ?? item.cve_id ?? String(index)}>
                <td>
                  <strong className="mono">
                    {item.id ?? item.cve_id ?? "-"}
                  </strong>
                </td>
                <td>
                  <SeverityBadge severity={item.severity} />
                </td>
                <td>{item.package ?? item.package_name ?? "-"}</td>
                <td className="mono">
                  {item.version ?? item.package_version ?? "-"}
                </td>
                <td className="mono">
                  {item.fix_version ?? item.fixed_version ?? t("暂无")}
                </td>
                <td className="vulnerability-description">
                  {item.description ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function normalizedAddition(raw: unknown): unknown {
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

function AdditionContent({
  tab,
  data,
}: {
  tab: ArtifactDetailTab;
  data: unknown;
}) {
  const { locale, t } = useLocale();
  const record = isRecord(data) ? data : {};
  if (tab === "sbom") {
    const packages = recordArray(record.packages);
    if (packages.length)
      return (
        <>
          <div className="addition-summary">
            <span className="badge badge-blue">
              {stringValue(record.spdxVersion, "SBOM")}
            </span>
            <strong>
              {formatNumber(packages.length, locale)} {t("个软件包")}
            </strong>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("软件包")}</th>
                  <th>{t("版本")}</th>
                  <th>{t("许可证")}</th>
                  <th>{t("供应商")}</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((item, index) => (
                  <tr key={`${stringValue(item.name)}-${String(index)}`}>
                    <td>
                      <strong>
                        {stringValue(item.name ?? item.package_name, "-")}
                      </strong>
                    </td>
                    <td className="mono">
                      {stringValue(item.versionInfo ?? item.version, "-")}
                    </td>
                    <td>
                      {stringValue(
                        item.licenseConcluded ?? item.license,
                        t("未知"),
                      )}
                    </td>
                    <td>{stringValue(item.supplier ?? item.vendor, "-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
  }
  if (tab === "license") {
    const licenses = recordArray(record.licenses ?? data);
    if (licenses.length)
      return (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("许可证")}</th>
                <th>{t("标识")}</th>
                <th>{t("命中组件")}</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((item, index) => (
                <tr key={`${stringValue(item.id)}-${String(index)}`}>
                  <td>
                    <strong>
                      {stringValue(
                        item.name ?? item.license ?? item.id,
                        t("未知"),
                      )}
                    </strong>
                  </td>
                  <td className="mono">
                    {stringValue(item.id ?? item.spdx_id, "-")}
                  </td>
                  <td>
                    {formatNumber(
                      numberValue(item.count ?? item.package_count),
                      locale,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
  if (tab === "files") {
    const files = arrayValue(record.files ?? data);
    if (files.length)
      return (
        <div className="artifact-file-list">
          {files.map((item, index) => (
            <code key={String(index)}>
              {typeof item === "string"
                ? item
                : isRecord(item)
                  ? stringValue(item.path ?? item.name, JSON.stringify(item))
                  : JSON.stringify(item)}
            </code>
          ))}
        </div>
      );
  }
  if (tab === "build") {
    const history = recordArray(record.history ?? data);
    if (history.length)
      return (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("创建时间")}</th>
                <th>{t("构建指令")}</th>
                <th>{t("文件层")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, index) => (
                <tr key={String(index)}>
                  <td className="table-cell-time">
                    {formatDate(stringValue(item.created), locale)}
                  </td>
                  <td>
                    <code className="addition-command">
                      {stringValue(item.created_by ?? item.command, "-")}
                    </code>
                  </td>
                  <td>
                    {item.empty_layer === true ? (
                      <span className="badge">{t("仅元数据")}</span>
                    ) : (
                      <span className="badge badge-blue">{t("包含文件")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
  if (tab === "dependencies") {
    const dependencies = recordArray(record.dependencies ?? data);
    if (dependencies.length)
      return (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("依赖")}</th>
                <th>{t("版本")}</th>
                <th>{t("来源")}</th>
              </tr>
            </thead>
            <tbody>
              {dependencies.map((item, index) => (
                <tr key={`${stringValue(item.name)}-${String(index)}`}>
                  <td>
                    <strong>
                      {stringValue(item.name ?? item.package, "-")}
                    </strong>
                  </td>
                  <td className="mono">{stringValue(item.version, "-")}</td>
                  <td className="truncate-cell">
                    {stringValue(item.repository ?? item.source, "-")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
  return (
    <pre className="artifact-addition-code">
      <code>{artifactAdditionText(data)}</code>
    </pre>
  );
}

export function ArtifactAdditionSection({
  tab,
  value,
  loadError,
  onCopy,
  onDownload,
}: {
  tab: keyof typeof artifactAdditionTabs;
  value?: unknown;
  loadError?: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const { locale, t } = useLocale();
  const meta = artifactAdditionTabs[tab];
  if (loadError)
    return (
      <section className="panel">
        <EmptySection
          title={
            locale === "en-US"
              ? `${t(meta.label)} unavailable`
              : `${meta.label} 不可用`
          }
          description={loadError}
          icon="alert"
        />
      </section>
    );
  const data = normalizedAddition(value);
  if (
    data === undefined ||
    data === null ||
    data === "" ||
    (Array.isArray(data) && !data.length)
  )
    return (
      <section className="panel">
        <EmptySection
          title={
            locale === "en-US"
              ? `No ${t(meta.label).toLowerCase()}`
              : `没有${meta.label}`
          }
          description="当前制品未提供这项附加信息。"
          icon={meta.icon}
        />
      </section>
    );
  return (
    <section className="table-shell artifact-addition-panel">
      <div className="table-toolbar">
        <div>
          <strong>{t(meta.label)}</strong>
          <span className="toolbar-caption">
            {t("Harbor 官方制品附加信息")}
          </span>
        </div>
        <div className="toolbar-spacer" />
        <button className="button button-small" type="button" onClick={onCopy}>
          <Icon name="copy" />
          <span>{t("复制")}</span>
        </button>
        <button
          className="button button-small"
          type="button"
          onClick={onDownload}
        >
          <Icon name="database" />
          <span>{t("下载")}</span>
        </button>
      </div>
      <AdditionContent tab={tab} data={data} />
    </section>
  );
}

export function artifactAccessoryTypeLabel(value: string | undefined): string {
  const type = value?.toLowerCase() ?? "";
  if (type.includes("cosign") || type.includes("notation")) return "制品签名";
  if (type.includes("sbom")) return "软件物料清单";
  if (type.includes("attestation")) return "证明材料";
  return "关联制品";
}

export function ArtifactAccessoriesSection({
  collection,
  loadError,
  onOpen,
  onCopy,
  onDelete,
  onPageChange,
}: {
  collection: ControlList<ArtifactAccessory>;
  loadError?: string;
  onOpen: (item: ArtifactAccessory) => void;
  onCopy: (value: string) => void;
  onDelete: (item: ArtifactAccessory) => void;
  onPageChange: (page: number) => void;
}) {
  const { locale, t } = useLocale();
  if (loadError)
    return (
      <section className="panel">
        <EmptySection
          title="关联制品不可用"
          description={loadError}
          icon="alert"
        />
      </section>
    );
  if (!collection.items.length)
    return (
      <section className="panel">
        <EmptySection
          title="没有关联制品"
          description="签名、SBOM 和其他 OCI Referrer 会显示在这里。"
          icon="database"
        />
      </section>
    );
  return (
    <section className="table-shell">
      <div className="table-toolbar">
        <strong>{t("OCI 关联制品")}</strong>
        <div className="toolbar-spacer" />
        <span className="muted">
          {formatNumber(
            collection.pagination.total || collection.items.length,
            locale,
          )}{" "}
          {t("项")}
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("类型")}</th>
              <th>{t("摘要")}</th>
              <th>{t("大小")}</th>
              <th className="table-cell-time">{t("创建时间")}</th>
              <th className="table-cell-center" />
            </tr>
          </thead>
          <tbody>
            {collection.items.map((item) => (
              <tr key={item.id ?? item.digest}>
                <td>
                  <div className="cell-title">
                    <span className="cell-stack">
                      <strong>
                        {t(artifactAccessoryTypeLabel(item.type))}
                      </strong>
                      <small>{item.type ?? "OCI Referrer"}</small>
                    </span>
                  </div>
                </td>
                <td>
                  <code title={item.digest}>{shortDigest(item.digest)}</code>
                </td>
                <td>{formatBytes(item.size, locale)}</td>
                <td className="table-cell-time">
                  {formatDate(item.creation_time, locale)}
                </td>
                <td className="table-cell-center">
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      type="button"
                      title={t("打开关联制品")}
                      aria-label={t("打开关联制品")}
                      onClick={() => onOpen(item)}
                    >
                      <Icon name="external" />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      title={t("复制摘要")}
                      aria-label={t("复制摘要")}
                      onClick={() => onCopy(item.digest)}
                    >
                      <Icon name="copy" />
                    </button>
                    <button
                      className="icon-button danger-icon"
                      type="button"
                      title={t("删除关联制品")}
                      aria-label={t("删除关联制品")}
                      onClick={() => onDelete(item)}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        pagination={collection.pagination}
        onPageChange={onPageChange}
      />
    </section>
  );
}

export { LabelChip };
