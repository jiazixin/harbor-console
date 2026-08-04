import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { controlApi } from "../../app/api-client";
import { downloadText } from "../../app/download-text";
import { formatBytes, formatDate, formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type {
  ArtifactAccessory,
  ArtifactLabelCollection,
  ArtifactTag,
  ArtifactVulnerabilityReport,
  ControlList,
  HarborArtifact,
  ProjectLabel,
  ProjectSummary,
  Session,
} from "../../app/models";
import { Icon, type IconName } from "../../components/icons";
import {
  Breadcrumb,
  DemoBanner,
  PageHeader,
  RefreshButton,
  StatCell,
} from "../../components/page-elements";
import { useCenterActiveTab } from "../../components/use-center-active-tab";
import {
  ArtifactAccessoriesSection,
  ArtifactAdditionSection,
  artifactAdditionTabs,
  artifactAdditionText,
  type ArtifactDetailTab,
  ArtifactLabelsSection,
  ArtifactOverviewSection,
  ArtifactTagsSection,
  ArtifactVulnerabilitiesSection,
  LabelChip,
} from "./artifact-detail-sections";
import {
  artifactArchitectureSummary,
  artifactScanState,
  repositoryDisplayName,
  shortDigest,
} from "./artifact-utils";

const artifactPageSize = 50;
const additionTabKeys = Object.keys(
  artifactAdditionTabs,
) as (keyof typeof artifactAdditionTabs)[];

const artifactTabs: {
  key: ArtifactDetailTab;
  label: string;
  icon: IconName;
}[] = [
  { key: "overview", label: "概览", icon: "package" },
  { key: "tags", label: "Tag", icon: "tag" },
  { key: "labels", label: "标签", icon: "tag" },
  { key: "vulnerabilities", label: "漏洞", icon: "shield" },
  ...additionTabKeys.map((key) => ({
    key,
    label: artifactAdditionTabs[key].label,
    icon: artifactAdditionTabs[key].icon,
  })),
  { key: "accessories", label: "关联制品", icon: "database" },
];

const artifactTabNames = new Set<ArtifactDetailTab>(
  artifactTabs.map((tab) => tab.key),
);

type ArtifactRouteState = {
  project: string;
  repository: string;
  reference: string;
  tab: ArtifactDetailTab;
  page: number;
};

type ArtifactDetailData = {
  artifact: HarborArtifact;
  tags?: ControlList<ArtifactTag>;
  labels?: ArtifactLabelCollection;
  vulnerabilities?: ArtifactVulnerabilityReport;
  vulnerabilityError?: string;
  accessories?: ControlList<ArtifactAccessory>;
  accessoryError?: string;
  addition?: unknown;
  additionError?: string;
};

type ArtifactActionContext = {
  project: string;
  repository: string;
  artifact: HarborArtifact;
};

export type ArtifactDetailAction =
  | (ArtifactActionContext & { kind: "add-tag" })
  | (ArtifactActionContext & {
      kind: "attach-label";
      labels: ProjectLabel[];
    })
  | (ArtifactActionContext & { kind: "copy" })
  | (ArtifactActionContext & { kind: "delete" })
  | (ArtifactActionContext & {
      kind: "delete-accessory";
      accessory: ArtifactAccessory;
    })
  | (ArtifactActionContext & { kind: "delete-tag"; tag: ArtifactTag })
  | (ArtifactActionContext & {
      kind: "remove-label";
      label: ProjectLabel;
    })
  | (ArtifactActionContext & { kind: "scan" })
  | (ArtifactActionContext & { kind: "scan-log"; reportId: string })
  | (ArtifactActionContext & {
      kind: "stop-scan";
      scanType: "sbom" | "vulnerability";
    });

function positiveInteger(value: string | null): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function artifactTab(value: string | null): ArtifactDetailTab {
  return artifactTabNames.has(value as ArtifactDetailTab)
    ? (value as ArtifactDetailTab)
    : "overview";
}

function artifactPath(
  state: ArtifactRouteState,
  updates: Partial<Pick<ArtifactRouteState, "page" | "reference" | "tab">> = {},
): string {
  const next = { ...state, ...updates };
  const query = new URLSearchParams();
  if (next.page > 1) query.set("page", String(next.page));
  if (next.tab !== "overview") query.set("tab", next.tab);
  const base = `projects/${encodeURIComponent(next.project)}/repositories/${encodeURIComponent(next.repository)}/artifacts/${encodeURIComponent(next.reference)}`;
  return `${base}${query.size ? `?${query}` : ""}`;
}

function repositoryPath(project: string, repository: string): string {
  return `projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function abortIfNeeded(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
}

async function loadArtifactLabels(
  state: ArtifactRouteState,
  artifact: HarborArtifact,
  signal: AbortSignal,
): Promise<ArtifactLabelCollection> {
  const globalLabels = controlApi.list<ProjectLabel>(
    "labels",
    { scope: "g", page: 1, page_size: 100, sort: "name" },
    signal,
  );
  const projectLabels = controlApi
    .data<ProjectSummary>("project", { project: state.project }, signal)
    .then((project) => {
      if (!project) throw new Error("项目不存在");
      return controlApi.list<ProjectLabel>(
        "labels",
        {
          scope: "p",
          project_id: project.project_id ?? 0,
          page: 1,
          page_size: 100,
          sort: "name",
        },
        signal,
      );
    });
  const [projectResult, globalResult] = await Promise.allSettled([
    projectLabels,
    globalLabels,
  ]);
  abortIfNeeded(signal);
  const available: ProjectLabel[] = [];
  const errors: string[] = [];
  if (projectResult.status === "fulfilled") {
    available.push(...projectResult.value.items);
  } else {
    errors.push(errorMessage(projectResult.reason));
  }
  if (globalResult.status === "fulfilled") {
    available.push(...globalResult.value.items);
  } else {
    errors.push(errorMessage(globalResult.reason));
  }
  return {
    attached: artifact.labels ?? [],
    available,
    load_error: errors.length ? errors.join("；") : undefined,
  };
}

async function loadArtifactData(
  state: ArtifactRouteState,
  signal: AbortSignal,
): Promise<ArtifactDetailData> {
  const artifact = await controlApi.data<HarborArtifact>(
    "artifact",
    {
      project: state.project,
      repository: state.repository,
      reference: state.reference,
      with_tag: true,
      with_label: true,
      with_scan_overview: true,
      with_sbom_overview: true,
      with_accessory: true,
      with_immutable_status: true,
    },
    signal,
  );
  if (!artifact) throw new Error("制品不存在");
  const result: ArtifactDetailData = { artifact };
  if (state.tab === "tags") {
    result.tags = await controlApi.list<ArtifactTag>(
      "artifact-tags",
      {
        project: state.project,
        repository: state.repository,
        reference: state.reference,
        page: state.page,
        page_size: artifactPageSize,
        sort: "-push_time",
        with_immutable_status: true,
      },
      signal,
    );
  } else if (state.tab === "labels") {
    result.labels = await loadArtifactLabels(state, artifact, signal);
  } else if (state.tab === "vulnerabilities") {
    try {
      result.vulnerabilities =
        await controlApi.data<ArtifactVulnerabilityReport>(
          "artifact-vulnerabilities",
          {
            project: state.project,
            repository: state.repository,
            reference: state.reference,
          },
          signal,
        );
    } catch (error) {
      if (isAbortError(error)) throw error;
      result.vulnerabilityError = errorMessage(error);
    }
  } else if (state.tab === "accessories") {
    try {
      result.accessories = await controlApi.list<ArtifactAccessory>(
        "artifact-accessories",
        {
          project: state.project,
          repository: state.repository,
          reference: state.reference,
          page: state.page,
          page_size: artifactPageSize,
          sort: "-creation_time",
        },
        signal,
      );
    } catch (error) {
      if (isAbortError(error)) throw error;
      result.accessoryError = errorMessage(error);
      result.accessories = {
        items: [],
        pagination: { page: 1, page_size: artifactPageSize, total: 0 },
      };
    }
  } else if (state.tab in artifactAdditionTabs) {
    try {
      result.addition = await controlApi.data<unknown>(
        "artifact-addition",
        {
          project: state.project,
          repository: state.repository,
          reference: state.reference,
          addition:
            artifactAdditionTabs[state.tab as keyof typeof artifactAdditionTabs]
              .addition,
        },
        signal,
      );
    } catch (error) {
      if (isAbortError(error)) throw error;
      result.additionError = errorMessage(error);
    }
  }
  abortIfNeeded(signal);
  return result;
}

function canStopArtifactScan(status: string): boolean {
  return [
    "running",
    "pending",
    "queued",
    "scheduled",
    "in_progress",
    "inprogress",
  ].includes(status.toLowerCase());
}

function scanStatusLabel(status: string): string {
  return (
    {
      success: "成功",
      succeed: "成功",
      running: "运行中",
      pending: "等待中",
      queued: "排队中",
      scheduled: "已计划",
      stopped: "已停止",
      failed: "失败",
      error: "异常",
      "not scanned": "未扫描",
    }[status.toLowerCase()] ?? status
  );
}

function severityLabel(severity: string): string {
  return (
    {
      critical: "严重",
      high: "高危",
      medium: "中危",
      low: "低危",
      negligible: "可忽略",
      none: "无风险",
      unknown: "未扫描",
    }[severity.toLowerCase()] ?? severity
  );
}

function sanitizedFilenamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "-");
}

export function ArtifactDetailPage({
  route,
  session,
  refreshing,
  navigate,
  onRefresh,
  onAction,
  onNotice,
}: {
  route: ConsoleRoute;
  session: Session;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => Promise<void>;
  onAction: (action: ArtifactDetailAction) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const project = route.segments[1] ?? "";
  const repository = route.segments[3] ?? "";
  const reference = route.segments[5] ?? "";
  const query = route.query.toString();
  const tabValue = route.query.get("tab");
  const pageValue = route.query.get("page");
  const routeState = useMemo<ArtifactRouteState>(
    () => ({
      project,
      repository,
      reference,
      tab: artifactTab(tabValue),
      page: positiveInteger(pageValue),
    }),
    [pageValue, project, reference, repository, tabValue],
  );
  const routeKey = `${project}/${repository}/${reference}?${query}`;
  const [data, setData] = useState<ArtifactDetailData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const requestVersion = useRef(0);
  const tabsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setData(undefined);
    setLoading(true);
    setError("");
    void loadArtifactData(routeState, controller.signal)
      .then((next) => {
        if (requestVersion.current === version) setData(next);
      })
      .catch((loadError: unknown) => {
        if (isAbortError(loadError)) return;
        if (requestVersion.current === version)
          setError(errorMessage(loadError));
      })
      .finally(() => {
        if (requestVersion.current === version && !controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [reloadToken, routeKey, routeState]);

  useCenterActiveTab(tabsRef, `${routeState.tab}-${data ? "loaded" : "empty"}`);

  const refreshPage = useCallback(async () => {
    await onRefresh();
    setReloadToken((current) => current + 1);
  }, [onRefresh]);

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      onNotice("已复制到剪贴板");
    } catch {
      onNotice("浏览器未允许复制，请手动选择内容。", true);
    }
  }

  const displayRepository = repositoryDisplayName(project, repository);
  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "项目", href: "#/projects" },
        {
          label: project,
          href: `#/projects/${encodeURIComponent(project)}/repositories`,
        },
        {
          label: displayRepository,
          href: `#/${repositoryPath(project, repository)}`,
        },
        { label: shortDigest(reference) },
      ]}
    />
  );

  if (loading && !data) {
    return (
      <>
        <PageHeader
          title="制品详情"
          subtitle={shortDigest(reference)}
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
          <h2>{t("制品详情载入失败")}</h2>
          <p>{error || t("制品不存在")}</p>
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

  const artifact = data.artifact;
  const artifactContext: ArtifactActionContext = {
    project,
    repository,
    artifact,
  };
  const tags = artifact.tags ?? [];
  const title = tags[0]?.name || shortDigest(artifact.digest);
  const scan = artifactScanState(artifact);
  const sbom = artifactScanState(artifact, "sbom");
  const runningScan = canStopArtifactScan(scan.status)
    ? ("vulnerability" as const)
    : canStopArtifactScan(sbom.status)
      ? ("sbom" as const)
      : undefined;

  let section;
  if (routeState.tab === "tags") {
    section = (
      <ArtifactTagsSection
        artifact={artifact}
        project={project}
        repository={repository}
        instanceUrl={session.instance_url}
        collection={
          data.tags ?? {
            items: [],
            pagination: { page: 1, page_size: artifactPageSize, total: 0 },
          }
        }
        onAdd={() => onAction({ ...artifactContext, kind: "add-tag" })}
        onCopy={(value) => void copyValue(value)}
        onDelete={(tag) =>
          onAction({ ...artifactContext, kind: "delete-tag", tag })
        }
        onPageChange={(page) => navigate(artifactPath(routeState, { page }))}
      />
    );
  } else if (routeState.tab === "labels") {
    const labels = data.labels ?? {
      attached: artifact.labels ?? [],
      available: [],
    };
    section = (
      <ArtifactLabelsSection
        collection={labels}
        onAttach={() => {
          const attachedIds = new Set(
            labels.attached.map((label) => String(label.id)),
          );
          const available = labels.available.filter(
            (label) => !attachedIds.has(String(label.id)),
          );
          if (!available.length) {
            onNotice("没有可绑定的项目或全局标签", true);
            return;
          }
          onAction({
            ...artifactContext,
            kind: "attach-label",
            labels: available,
          });
        }}
        onRemove={(label) =>
          onAction({ ...artifactContext, kind: "remove-label", label })
        }
      />
    );
  } else if (routeState.tab === "vulnerabilities") {
    section = (
      <ArtifactVulnerabilitiesSection
        report={data.vulnerabilities}
        loadError={data.vulnerabilityError}
      />
    );
  } else if (routeState.tab === "accessories") {
    section = (
      <ArtifactAccessoriesSection
        collection={
          data.accessories ?? {
            items: [],
            pagination: { page: 1, page_size: artifactPageSize, total: 0 },
          }
        }
        loadError={data.accessoryError}
        onOpen={(accessory) =>
          navigate(
            artifactPath(routeState, {
              reference: accessory.digest,
              tab: "overview",
              page: 1,
            }),
          )
        }
        onCopy={(value) => void copyValue(value)}
        onDelete={(accessory) =>
          onAction({
            ...artifactContext,
            kind: "delete-accessory",
            accessory,
          })
        }
        onPageChange={(page) => navigate(artifactPath(routeState, { page }))}
      />
    );
  } else if (routeState.tab in artifactAdditionTabs) {
    const additionTab = routeState.tab as keyof typeof artifactAdditionTabs;
    const addition = artifactAdditionTabs[additionTab];
    section = (
      <ArtifactAdditionSection
        tab={additionTab}
        value={data.addition}
        loadError={data.additionError}
        onCopy={() => void copyValue(artifactAdditionText(data.addition))}
        onDownload={() => {
          downloadText(
            artifactAdditionText(data.addition),
            `${sanitizedFilenamePart(project)}-${sanitizedFilenamePart(repository)}-${addition.addition}`,
          );
          onNotice(`${addition.label} 已下载`);
        }}
      />
    );
  } else {
    section = (
      <ArtifactOverviewSection
        artifact={artifact}
        project={project}
        repository={repository}
        instanceUrl={session.instance_url}
        onCopy={(value) => void copyValue(value)}
        onOpenChild={(digest) =>
          navigate(
            artifactPath(routeState, {
              reference: digest,
              tab: "overview",
              page: 1,
            }),
          )
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={`${displayRepository} · ${formatBytes(artifact.size, locale)} · ${artifactArchitectureSummary(artifact, locale)}`}
        breadcrumb={breadcrumb}
        actions={
          <div className="artifact-detail-actions">
            <RefreshButton
              refreshing={refreshing || loading}
              onRefresh={() => void refreshPage()}
            />
            {scan.reportId ? (
              <button
                className="button button-small"
                type="button"
                onClick={() =>
                  onAction({
                    ...artifactContext,
                    kind: "scan-log",
                    reportId: scan.reportId,
                  })
                }
              >
                <Icon name="terminal" />
                <span>{t("扫描日志")}</span>
              </button>
            ) : null}
            {runningScan ? (
              <button
                className="button button-small button-danger"
                type="button"
                onClick={() =>
                  onAction({
                    ...artifactContext,
                    kind: "stop-scan",
                    scanType: runningScan,
                  })
                }
              >
                <Icon name="x" />
                <span>
                  {t(runningScan === "sbom" ? "停止 SBOM" : "停止扫描")}
                </span>
              </button>
            ) : null}
            <button
              className="button button-small"
              type="button"
              onClick={() => onAction({ ...artifactContext, kind: "scan" })}
            >
              <Icon name="shield" />
              <span>{t("扫描 / SBOM")}</span>
            </button>
            <button
              className="button button-small"
              type="button"
              onClick={() => onAction({ ...artifactContext, kind: "copy" })}
            >
              <Icon name="copy" />
              <span>{t("复制制品")}</span>
            </button>
            <button
              className="button button-small button-primary"
              type="button"
              onClick={() => onAction({ ...artifactContext, kind: "add-tag" })}
            >
              <Icon name="tag" />
              <span>{t("添加 Tag")}</span>
            </button>
            <button
              className="button button-small button-danger"
              type="button"
              onClick={() => onAction({ ...artifactContext, kind: "delete" })}
            >
              <Icon name="trash" />
              <span>{t("删除制品")}</span>
            </button>
          </div>
        }
      />
      {session.demo ? <DemoBanner /> : null}
      <section className="artifact-identity">
        <div>
          <span className="eyebrow">{t("制品摘要")}</span>
          <strong className="mono digest-full">{artifact.digest}</strong>
          {artifact.labels?.length ? (
            <span className="artifact-identity-labels">
              {artifact.labels.map((label) => (
                <LabelChip key={label.id} label={label} />
              ))}
            </span>
          ) : null}
        </div>
        <button
          className="button button-small"
          type="button"
          onClick={() => void copyValue(artifact.digest)}
        >
          <Icon name="copy" />
          <span>{t("复制摘要")}</span>
        </button>
      </section>
      <section
        className="overview-stats project-stats"
        aria-label={t("制品统计")}
      >
        <StatCell
          label={t("扫描状态")}
          value={t(scanStatusLabel(scan.status))}
          foot={
            locale === "en-US"
              ? `${t("最高风险")}: ${t(severityLabel(scan.severity))}`
              : `${t("最高风险")}：${t(severityLabel(scan.severity))}`
          }
          icon="shield"
        />
        <StatCell
          label={t("严重漏洞")}
          value={formatNumber(scan.counts.critical, locale)}
          foot={t("需要立即处理")}
          icon="alert"
        />
        <StatCell
          label="Tag"
          value={formatNumber(tags.length, locale)}
          foot={t("当前制品引用")}
          icon="tag"
        />
        <StatCell
          label={t("推送时间")}
          value={formatDate(artifact.push_time, locale)}
          foot={t("最近入库")}
          icon="history"
        />
      </section>
      <nav
        ref={tabsRef}
        className="resource-tabs artifact-tabs"
        aria-label={t("制品页面")}
      >
        {artifactTabs.map((tab) => (
          <a
            key={tab.key}
            href={`#/${artifactPath(routeState, {
              tab: tab.key,
              page: 1,
            })}`}
            className={routeState.tab === tab.key ? "active" : undefined}
            aria-current={routeState.tab === tab.key ? "page" : undefined}
          >
            <Icon name={tab.icon} />
            <span>{t(tab.label)}</span>
          </a>
        ))}
      </nav>
      {section}
    </>
  );
}
