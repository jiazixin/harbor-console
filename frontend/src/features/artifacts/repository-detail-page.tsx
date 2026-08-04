import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { controlApi } from "../../app/api-client";
import { formatBytes, formatDate, formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type {
  ControlList,
  HarborArtifact,
  ProjectLabel,
  ProjectSummary,
  RepositorySummary,
  Session,
} from "../../app/models";
import { Pagination } from "../../components/data-table";
import { Icon } from "../../components/icons";
import {
  Breadcrumb,
  DemoBanner,
  PageHeader,
  RefreshButton,
  StatCell,
} from "../../components/page-elements";
import { SeverityBadge, StatusBadge } from "../../components/status-badge";
import { UnifiedSelect } from "../../components/unified-select";
import {
  artifactMatchesScanStatus,
  artifactPlatformLabel,
  artifactPlatforms,
  artifactScanState,
  artifactSignatureState,
  repositoryDisplayName,
  shortDigest,
} from "./artifact-utils";

const pageSize = 50;
const artifactTypes = ["IMAGE", "CHART", "CNAB", "WASM"] as const;
const tagStates = ["tagged", "untagged"] as const;
const scanStatuses = [
  "success",
  "running",
  "error",
  "stopped",
  "unscanned",
] as const;

type ArtifactType = (typeof artifactTypes)[number] | "";
type TagState = (typeof tagStates)[number] | "";
type ScanStatus = (typeof scanStatuses)[number] | "";

type RepositoryRouteState = {
  project: string;
  repository: string;
  page: number;
  query: string;
  artifactType: ArtifactType;
  tagState: TagState;
  labelId: string;
  scanStatus: ScanStatus;
};

type RepositoryData = {
  repository: RepositorySummary;
  project: ProjectSummary;
  artifacts: ControlList<HarborArtifact>;
  labels: ProjectLabel[];
};

export type RepositoryArtifactAction =
  | {
      kind: "attach-label";
      project: string;
      repository: string;
      artifacts: HarborArtifact[];
      labels: ProjectLabel[];
    }
  | {
      kind: "copy";
      project: string;
      repository: string;
      artifact: HarborArtifact;
    }
  | {
      kind: "delete";
      project: string;
      repository: string;
      artifacts: HarborArtifact[];
    }
  | {
      kind: "remove-label";
      project: string;
      repository: string;
      artifacts: HarborArtifact[];
      labels: ProjectLabel[];
    };

function positiveInteger(value: string | null): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function oneOf<T extends string>(
  value: string | null,
  candidates: readonly T[],
): T | "" {
  return candidates.includes(value as T) ? (value as T) : "";
}

function parseRoute(route: ConsoleRoute): RepositoryRouteState {
  return {
    project: route.segments[1] ?? "",
    repository: route.segments[3] ?? "",
    page: positiveInteger(route.query.get("page")),
    query: route.query.get("q") ?? "",
    artifactType: oneOf(route.query.get("type"), artifactTypes),
    tagState: oneOf(route.query.get("tags"), tagStates),
    labelId: /^\d+$/.test(route.query.get("label") ?? "")
      ? (route.query.get("label") ?? "")
      : "",
    scanStatus: oneOf(route.query.get("scan"), scanStatuses),
  };
}

function artifactQuery(state: RepositoryRouteState): string {
  const filters: string[] = [];
  if (state.query) filters.push(`tags=~${state.query}`);
  else if (state.tagState === "tagged") filters.push("tags=*");
  else if (state.tagState === "untagged") filters.push("tags=nil");
  if (state.artifactType) filters.push(`type=${state.artifactType}`);
  if (/^[1-9]\d*$/.test(state.labelId)) {
    filters.push(`labels=(${state.labelId})`);
  }
  return filters.join(",");
}

function artifactParameters(
  state: RepositoryRouteState,
  page: number,
  requestedPageSize: number,
) {
  return {
    project: state.project,
    repository: state.repository,
    page,
    page_size: requestedPageSize,
    sort: "-push_time",
    q: artifactQuery(state),
    with_tag: true,
    with_label: true,
    with_scan_overview: true,
    with_sbom_overview: true,
    with_immutable_status: true,
    with_accessory: true,
  };
}

async function loadArtifacts(
  state: RepositoryRouteState,
  signal: AbortSignal,
): Promise<ControlList<HarborArtifact>> {
  if (!state.scanStatus) {
    return controlApi.list<HarborArtifact>(
      "artifacts",
      artifactParameters(state, state.page, pageSize),
      signal,
    );
  }
  const all: HarborArtifact[] = [];
  for (let page = 1; page <= 200; page += 1) {
    const result = await controlApi.list<HarborArtifact>(
      "artifacts",
      artifactParameters(state, page, 100),
      signal,
    );
    all.push(...result.items);
    if (page * 100 >= result.pagination.total || result.items.length < 100) {
      break;
    }
    if (page === 200) {
      throw new Error(
        "扫描状态筛选最多处理 20000 个制品，请先使用类型、Tag 或标签缩小范围",
      );
    }
  }
  const filtered = all.filter((artifact) =>
    artifactMatchesScanStatus(artifact, state.scanStatus),
  );
  const start = (state.page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    pagination: {
      page: state.page,
      page_size: pageSize,
      total: filtered.length,
    },
  };
}

async function loadRepositoryData(
  state: RepositoryRouteState,
  signal: AbortSignal,
): Promise<RepositoryData> {
  const repositoryPromise = controlApi.data<RepositorySummary>(
    "repository",
    { project: state.project, repository: state.repository },
    signal,
  );
  const projectPromise = controlApi.data<ProjectSummary>(
    "project",
    { project: state.project },
    signal,
  );
  const artifactsPromise = loadArtifacts(state, signal);
  const project = await projectPromise;
  if (!project) throw new Error("项目不存在");
  const projectId = project.project_id ?? 0;
  const [repository, artifacts, projectLabels, globalLabels] =
    await Promise.all([
      repositoryPromise,
      artifactsPromise,
      controlApi
        .list<ProjectLabel>(
          "labels",
          {
            scope: "p",
            project_id: projectId,
            page: 1,
            page_size: 100,
            sort: "name",
          },
          signal,
        )
        .catch(() => ({
          items: [],
          pagination: { page: 1, page_size: 100, total: 0 },
        })),
      controlApi
        .list<ProjectLabel>(
          "labels",
          { scope: "g", page: 1, page_size: 100, sort: "name" },
          signal,
        )
        .catch(() => ({
          items: [],
          pagination: { page: 1, page_size: 100, total: 0 },
        })),
    ]);
  if (!repository) throw new Error("仓库不存在");
  return {
    repository,
    project,
    artifacts,
    labels: [...projectLabels.items, ...globalLabels.items],
  };
}

function repositoryPath(
  state: RepositoryRouteState,
  updates: Partial<RepositoryRouteState>,
): string {
  const next = { ...state, ...updates };
  const query = new URLSearchParams();
  if (next.page > 1) query.set("page", String(next.page));
  if (next.query) query.set("q", next.query);
  if (next.artifactType) query.set("type", next.artifactType);
  if (next.tagState && !next.query) query.set("tags", next.tagState);
  if (next.labelId) query.set("label", next.labelId);
  if (next.scanStatus) query.set("scan", next.scanStatus);
  const base = `projects/${encodeURIComponent(next.project)}/repositories/${encodeURIComponent(next.repository)}/artifacts`;
  return `${base}${query.size ? `?${query}` : ""}`;
}

function artifactPath(
  project: string,
  repository: string,
  reference: string,
): string {
  return `projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts/${encodeURIComponent(reference)}`;
}

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

function ArtifactTable({
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
  selected: Set<string>;
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
      <div className="empty-state">
        <span className="state-icon">
          <Icon name="package" />
        </span>
        <h2>{t("暂无制品")}</h2>
        <p>{t("向该仓库推送镜像后会显示在这里。")}</p>
      </div>
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
          <th className="table-cell-center">{t("架构")}</th>
          <th className="table-cell-center">{t("签名")}</th>
          <th>{t("注释")}</th>
          <th className="table-cell-center">{t("扫描状态")}</th>
          <th className="table-cell-center">{t("最高风险")}</th>
          <th>{t("大小")}</th>
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
              <td className="table-cell-center">
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
              <td>{formatBytes(artifact.size, locale)}</td>
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

export function RepositoryDetailPage({
  route,
  session,
  refreshing,
  navigate,
  onRefresh,
  onShowPushCommand,
  onEditRepository,
  onDeleteRepository,
  onArtifactAction,
  onNotice,
}: {
  route: ConsoleRoute;
  session: Session;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => Promise<void>;
  onShowPushCommand: (project: string, repository: string) => void;
  onEditRepository: (project: string, repository: RepositorySummary) => void;
  onDeleteRepository: (project: string, repository: RepositorySummary) => void;
  onArtifactAction: (action: RepositoryArtifactAction) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const routeKey = `${route.path}?${route.query.toString()}`;
  const routeState = useMemo(() => parseRoute(route), [routeKey]);
  const [data, setData] = useState<RepositoryData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [query, setQuery] = useState(routeState.query);
  const [artifactType, setArtifactType] = useState(routeState.artifactType);
  const [tagState, setTagState] = useState(routeState.tagState);
  const [labelId, setLabelId] = useState(routeState.labelId);
  const [scanStatus, setScanStatus] = useState(routeState.scanStatus);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [batchBusy, setBatchBusy] = useState(false);

  useEffect(() => {
    setQuery(routeState.query);
    setArtifactType(routeState.artifactType);
    setTagState(routeState.tagState);
    setLabelId(routeState.labelId);
    setScanStatus(routeState.scanStatus);
    setSelected(new Set());
  }, [routeKey, routeState]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void loadRepositoryData(routeState, controller.signal)
      .then(setData)
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadToken, routeKey, routeState]);

  const refreshPage = useCallback(async () => {
    await onRefresh();
    setReloadToken((current) => current + 1);
  }, [onRefresh]);

  const selectedArtifacts = useMemo(() => {
    const selectedDigests = selected;
    return (data?.artifacts.items ?? []).filter((artifact) =>
      selectedDigests.has(artifact.digest),
    );
  }, [data?.artifacts.items, selected]);

  function updateRoute(updates: Partial<RepositoryRouteState>) {
    navigate(repositoryPath(routeState, updates));
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateRoute({
      page: 1,
      query: query.trim(),
      artifactType,
      tagState: query.trim() ? "" : tagState,
      labelId,
      scanStatus,
    });
  }

  async function runBatch(
    title: string,
    worker: (artifact: HarborArtifact) => Promise<unknown>,
  ) {
    if (!selectedArtifacts.length) return;
    setBatchBusy(true);
    const results = await Promise.allSettled(selectedArtifacts.map(worker));
    const failures = results.filter(
      (result) => result.status === "rejected",
    ).length;
    setBatchBusy(false);
    setSelected(new Set());
    onNotice(
      failures
        ? `${title}完成，${String(failures)} 项失败`
        : `${title}已提交，共 ${formatNumber(selectedArtifacts.length, locale)} 个制品`,
      failures > 0,
    );
    setReloadToken((current) => current + 1);
  }

  const loadedRepository = data?.repository;
  const displayName = repositoryDisplayName(
    routeState.project,
    loadedRepository?.name ?? routeState.repository,
  );
  const activeFilters = Boolean(
    routeState.query ||
    routeState.artifactType ||
    routeState.tagState ||
    routeState.labelId ||
    routeState.scanStatus,
  );

  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "项目", href: "#/projects" },
        {
          label: routeState.project,
          href: `#/projects/${encodeURIComponent(routeState.project)}/repositories`,
        },
        { label: displayName },
      ]}
    />
  );

  if (loading && !data) {
    return (
      <>
        <PageHeader
          title={displayName}
          subtitle={t("正在读取仓库制品")}
          breadcrumb={breadcrumb}
          actions={<RefreshButton refreshing onRefresh={() => undefined} />}
        />
        {session.demo ? <DemoBanner /> : null}
        <section className="table-shell">
          <div className="loading-state">
            <div>
              <span className="spinner" />
            </div>
          </div>
        </section>
      </>
    );
  }

  if (error || !data) {
    return (
      <div className="error-state" role="alert">
        <div>
          <span className="state-icon">
            <Icon name="alert" />
          </span>
          <h2>{t("仓库详情载入失败")}</h2>
          <p>{error ? error : t("仓库不存在")}</p>
          <button
            className="button button-small"
            type="button"
            onClick={() => setReloadToken((current) => current + 1)}
          >
            <Icon name="refresh" />
            <span>{t("重试")}</span>
          </button>
        </div>
      </div>
    );
  }

  const repository = data.repository;

  return (
    <>
      <PageHeader
        title={displayName}
        subtitle={
          repository.description?.trim()
            ? repository.description
            : locale === "en-US"
              ? `${formatNumber(repository.artifact_count, locale)} artifacts · ${formatNumber(repository.pull_count, locale)} pulls`
              : `${formatNumber(repository.artifact_count, locale)} 个制品 · ${formatNumber(repository.pull_count, locale)} 次拉取`
        }
        breadcrumb={breadcrumb}
        actions={
          <>
            <RefreshButton
              refreshing={refreshing || loading}
              onRefresh={() => void refreshPage()}
            />
            <button
              className="button button-small"
              type="button"
              onClick={() =>
                onShowPushCommand(routeState.project, repository.name)
              }
            >
              <Icon name="upload" />
              <span>{t("推送指引")}</span>
            </button>
            <button
              className="button button-small"
              type="button"
              onClick={() => onEditRepository(routeState.project, repository)}
            >
              <Icon name="edit" />
              <span>{t("编辑仓库")}</span>
            </button>
            <button
              className="button button-small button-danger"
              type="button"
              onClick={() => onDeleteRepository(routeState.project, repository)}
            >
              <Icon name="trash" />
              <span>{t("删除")}</span>
            </button>
          </>
        }
      />
      {session.demo ? <DemoBanner /> : null}
      <section
        className="overview-stats project-stats"
        aria-label={t("仓库统计")}
      >
        <StatCell
          label={t("制品")}
          value={formatNumber(
            repository.artifact_count ?? data.artifacts.pagination.total,
            locale,
          )}
          foot={t("当前仓库")}
          icon="package"
        />
        <StatCell
          label={t("拉取次数")}
          value={formatNumber(repository.pull_count, locale)}
          foot={t("累计拉取")}
          icon="download"
        />
        <StatCell
          label={t("最近更新")}
          value={formatDate(repository.update_time, locale)}
          foot={t("Harbor 仓库更新时间")}
          icon="refresh"
        />
        <StatCell
          label={t("仓库编号")}
          value={`#${String(repository.id ?? "-")}`}
          foot={routeState.project}
          icon="database"
        />
      </section>
      <section className="table-shell">
        <form
          className="table-toolbar artifact-filter-toolbar"
          onSubmit={submitFilters}
        >
          <label className="toolbar-search">
            <Icon name="search" />
            <input
              name="q"
              type="search"
              value={query}
              placeholder={t("按 Tag 搜索制品")}
              aria-label={t("按 Tag 搜索制品")}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <label className="toolbar-field">
            <span>{t("类型")}</span>
            <UnifiedSelect
              ariaLabel={t("类型")}
              className="toolbar-select"
              value={artifactType}
              options={[
                { value: "", label: t("全部") },
                ...artifactTypes.map((value) => ({ value, label: value })),
              ]}
              onChange={setArtifactType}
            />
          </label>
          <label className="toolbar-field">
            <span>Tag</span>
            <UnifiedSelect
              ariaLabel="Tag"
              className="toolbar-select"
              disabled={Boolean(query)}
              value={tagState}
              options={[
                { value: "", label: t("全部") },
                { value: "tagged", label: t("有 Tag") },
                { value: "untagged", label: t("无 Tag") },
              ]}
              onChange={setTagState}
            />
          </label>
          <label className="toolbar-field">
            <span>{t("标签")}</span>
            <UnifiedSelect
              ariaLabel={t("标签")}
              className="toolbar-select"
              value={labelId}
              options={[
                { value: "", label: t("全部") },
                ...data.labels.map((label) => ({
                  value: String(label.id),
                  label: t(label.name),
                })),
              ]}
              onChange={setLabelId}
            />
          </label>
          <label className="toolbar-field">
            <span>{t("扫描")}</span>
            <UnifiedSelect
              ariaLabel={t("扫描")}
              className="toolbar-select"
              value={scanStatus}
              options={[
                { value: "", label: t("全部") },
                { value: "success", label: t("成功") },
                { value: "running", label: t("运行中") },
                { value: "error", label: t("失败") },
                { value: "stopped", label: t("已停止") },
                { value: "unscanned", label: t("未扫描") },
              ]}
              onChange={setScanStatus}
            />
          </label>
          <div className="filter-toolbar-actions">
            <button
              className="button button-small button-primary"
              type="submit"
            >
              <Icon name="search" />
              <span>{t("筛选")}</span>
            </button>
            {activeFilters ? (
              <button
                className="button button-small"
                type="button"
                onClick={() =>
                  navigate(
                    repositoryPath(routeState, {
                      page: 1,
                      query: "",
                      artifactType: "",
                      tagState: "",
                      labelId: "",
                      scanStatus: "",
                    }),
                  )
                }
              >
                <Icon name="x" />
                <span>{t("清除")}</span>
              </button>
            ) : null}
          </div>
        </form>
        <div className="artifact-batch-toolbar">
          <span>
            <strong>{formatNumber(selectedArtifacts.length, locale)}</strong>{" "}
            {t("个已选择")}
          </span>
          <div>
            <button
              className="button button-small"
              type="button"
              disabled={!selectedArtifacts.length || batchBusy}
              onClick={() =>
                void runBatch("漏洞扫描", (artifact) =>
                  controlApi.mutate(
                    "artifact-scan",
                    {
                      project: routeState.project,
                      repository: routeState.repository,
                      reference: artifact.digest,
                    },
                    "POST",
                    { scan_type: "vulnerability" },
                  ),
                )
              }
            >
              <Icon name="shield" />
              <span>{t("扫描")}</span>
            </button>
            <button
              className="button button-small"
              type="button"
              disabled={!selectedArtifacts.length || batchBusy}
              onClick={() =>
                void runBatch("SBOM 生成", (artifact) =>
                  controlApi.mutate(
                    "artifact-scan",
                    {
                      project: routeState.project,
                      repository: routeState.repository,
                      reference: artifact.digest,
                    },
                    "POST",
                    { scan_type: "sbom" },
                  ),
                )
              }
            >
              <Icon name="database" />
              <span>{t("生成 SBOM")}</span>
            </button>
            <button
              className="button button-small"
              type="button"
              disabled={!selectedArtifacts.length || batchBusy}
              onClick={() =>
                void runBatch("停止扫描任务", async (artifact) => {
                  const types = (["vulnerability", "sbom"] as const).filter(
                    (type) =>
                      [
                        "running",
                        "pending",
                        "queued",
                        "scheduled",
                        "in_progress",
                        "inprogress",
                      ].includes(
                        artifactScanState(artifact, type).status.toLowerCase(),
                      ),
                  );
                  if (!types.length)
                    throw new Error("该制品没有可停止的扫描或 SBOM 任务");
                  await Promise.all(
                    types.map((scanType) =>
                      controlApi.mutate(
                        "artifact-scan-stop",
                        {
                          project: routeState.project,
                          repository: routeState.repository,
                          reference: artifact.digest,
                        },
                        "POST",
                        { scan_type: scanType },
                      ),
                    ),
                  );
                })
              }
            >
              <Icon name="x" />
              <span>{t("停止任务")}</span>
            </button>
            <button
              className="button button-small"
              type="button"
              disabled={!selectedArtifacts.length || batchBusy}
              onClick={() =>
                onArtifactAction({
                  kind: "attach-label",
                  project: routeState.project,
                  repository: routeState.repository,
                  artifacts: selectedArtifacts,
                  labels: data.labels,
                })
              }
            >
              <Icon name="tag" />
              <span>{t("添加标签")}</span>
            </button>
            <button
              className="button button-small"
              type="button"
              disabled={!selectedArtifacts.length || batchBusy}
              onClick={() =>
                onArtifactAction({
                  kind: "remove-label",
                  project: routeState.project,
                  repository: routeState.repository,
                  artifacts: selectedArtifacts,
                  labels: Array.from(
                    new Map(
                      selectedArtifacts
                        .flatMap((artifact) => artifact.labels ?? [])
                        .map((label) => [label.id, label]),
                    ).values(),
                  ),
                })
              }
            >
              <Icon name="x" />
              <span>{t("移除标签")}</span>
            </button>
            <button
              className="button button-small"
              type="button"
              disabled={selectedArtifacts.length !== 1 || batchBusy}
              onClick={() => {
                const artifact = selectedArtifacts.at(0);
                if (artifact)
                  onArtifactAction({
                    kind: "copy",
                    project: routeState.project,
                    repository: routeState.repository,
                    artifact,
                  });
              }}
            >
              <Icon name="copy" />
              <span>{t("复制制品")}</span>
            </button>
            <button
              className="button button-small button-danger"
              type="button"
              disabled={!selectedArtifacts.length || batchBusy}
              onClick={() =>
                onArtifactAction({
                  kind: "delete",
                  project: routeState.project,
                  repository: routeState.repository,
                  artifacts: selectedArtifacts,
                })
              }
            >
              <Icon name="trash" />
              <span>{t("删除")}</span>
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <ArtifactTable
            artifacts={data.artifacts.items}
            project={routeState.project}
            repository={repository.name}
            selected={selected}
            busy={batchBusy}
            navigate={navigate}
            onToggle={(digest) =>
              setSelected((current) => {
                const next = new Set(current);
                if (next.has(digest)) next.delete(digest);
                else next.add(digest);
                return next;
              })
            }
            onToggleAll={() =>
              setSelected((current) => {
                const next = new Set(current);
                const allSelected = data.artifacts.items.every((artifact) =>
                  next.has(artifact.digest),
                );
                data.artifacts.items.forEach((artifact) => {
                  if (allSelected) next.delete(artifact.digest);
                  else next.add(artifact.digest);
                });
                return next;
              })
            }
          />
        </div>
        <Pagination
          pagination={data.artifacts.pagination}
          onPageChange={(page) => updateRoute({ page })}
        />
      </section>
    </>
  );
}
