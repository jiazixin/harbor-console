import { useMemo, useRef } from "react";

import { downloadText } from "../../app/download-text";
import { formatBytes, formatDate, formatNumber } from "../../app/formatters";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type { HarborArtifact, Session } from "../../app/models";
import { ContentTransition } from "../../components/content-transition";
import { ErrorView } from "../../components/feedback";
import { Icon } from "../../components/icons";
import {
  Breadcrumb,
  DemoBanner,
  PageHeader,
  RefreshButton,
  StatCell,
} from "../../components/page-elements";
import { severityLabel } from "../../components/status-badge";
import { useCenterActiveTab } from "../../components/use-center-active-tab";
import {
  type ArtifactActionContext,
  type ArtifactDetailAction,
  type ArtifactDetailData,
  artifactPageSize,
  artifactPath,
  type ArtifactRouteState,
  artifactTab,
  artifactTabs,
  positiveInteger,
  repositoryPath,
  useArtifactDetail,
} from "./artifact-detail-data";
import {
  ArtifactAccessoriesSection,
  ArtifactAdditionSection,
  artifactAdditionTabs,
  artifactAdditionText,
  artifactHasAddition,
  ArtifactLabelsSection,
  ArtifactOverviewSection,
  ArtifactTagsSection,
  ArtifactVulnerabilitiesSection,
  LabelChip,
} from "./artifact-detail-sections";
import {
  artifactArchitectureSummary,
  artifactScanState,
  isStoppableScanStatus,
  repositoryDisplayName,
  shortDigest,
} from "./artifact-utils";

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

function sanitizedFilenamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "-");
}

function emptyCollection() {
  return {
    items: [],
    pagination: { page: 1, page_size: artifactPageSize, total: 0 },
  };
}

function ArtifactHeaderActions({
  context,
  onAction,
}: {
  context: ArtifactActionContext;
  onAction: (action: ArtifactDetailAction) => void;
}) {
  const { t } = useLocale();
  const scan = artifactScanState(context.artifact);
  const sbom = artifactScanState(context.artifact, "sbom");
  const runningScan = isStoppableScanStatus(scan.status)
    ? ("vulnerability" as const)
    : isStoppableScanStatus(sbom.status)
      ? ("sbom" as const)
      : undefined;
  return (
    <>
      {scan.reportId ? (
        <button
          className="button button-small"
          type="button"
          onClick={() =>
            onAction({ ...context, kind: "scan-log", reportId: scan.reportId })
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
            onAction({ ...context, kind: "stop-scan", scanType: runningScan })
          }
        >
          <Icon name="x" />
          <span>{t(runningScan === "sbom" ? "停止 SBOM" : "停止扫描")}</span>
        </button>
      ) : null}
      <button
        className="button button-small"
        type="button"
        onClick={() => onAction({ ...context, kind: "scan" })}
      >
        <Icon name="shield" />
        <span>{t("扫描 / SBOM")}</span>
      </button>
      <button
        className="button button-small"
        type="button"
        onClick={() => onAction({ ...context, kind: "copy" })}
      >
        <Icon name="copy" />
        <span>{t("复制制品")}</span>
      </button>
      <button
        className="button button-small"
        type="button"
        onClick={() => onAction({ ...context, kind: "add-tag" })}
      >
        <Icon name="tag" />
        <span>{t("添加 Tag")}</span>
      </button>
      <button
        className="button button-small button-danger"
        type="button"
        onClick={() => onAction({ ...context, kind: "delete" })}
      >
        <Icon name="trash" />
        <span>{t("删除制品")}</span>
      </button>
    </>
  );
}

function ArtifactIdentity({
  artifact,
  onCopy,
}: {
  artifact: HarborArtifact;
  onCopy: (value: string) => void;
}) {
  const { t } = useLocale();
  return (
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
        onClick={() => onCopy(artifact.digest)}
      >
        <Icon name="copy" />
        <span>{t("复制摘要")}</span>
      </button>
    </section>
  );
}

function ArtifactStats({ artifact }: { artifact: HarborArtifact }) {
  const { locale, t } = useLocale();
  const scan = artifactScanState(artifact);
  const highestRisk = t(severityLabel(scan.severity));
  return (
    <section
      className="overview-stats project-stats"
      aria-label={t("制品统计")}
    >
      <StatCell
        label={t("扫描状态")}
        value={t(scanStatusLabel(scan.status))}
        foot={
          locale === "en-US"
            ? `${t("最高风险")}: ${highestRisk}`
            : `${t("最高风险")}：${highestRisk}`
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
        value={formatNumber(artifact.tags?.length ?? 0, locale)}
        foot={t("当前制品引用")}
        icon="tag"
      />
      <StatCell
        label={t("推送时间")}
        value={formatDate(artifact.push_time, locale, false)}
        foot={formatDate(artifact.push_time, locale)}
        icon="history"
      />
    </section>
  );
}

function ArtifactTabs({
  artifact,
  routeState,
}: {
  artifact: HarborArtifact;
  routeState: ArtifactRouteState;
}) {
  const { t } = useLocale();
  const tabsRef = useRef<HTMLElement>(null);
  useCenterActiveTab(tabsRef, routeState.tab);
  // Addition tabs appear only when the artifact provides that addition.
  const visibleTabs = artifactTabs.filter(
    (tab) =>
      !(tab.key in artifactAdditionTabs) ||
      tab.key === routeState.tab ||
      artifactHasAddition(
        artifact,
        tab.key as keyof typeof artifactAdditionTabs,
      ),
  );
  return (
    <nav
      ref={tabsRef}
      className="resource-tabs artifact-tabs"
      aria-label={t("制品页面")}
    >
      {visibleTabs.map((tab) => (
        <a
          key={tab.key}
          href={`#/${artifactPath(routeState, { tab: tab.key, page: 1 })}`}
          className={routeState.tab === tab.key ? "active" : undefined}
          aria-current={routeState.tab === tab.key ? "page" : undefined}
        >
          <Icon name={tab.icon} />
          <span>{t(tab.label)}</span>
        </a>
      ))}
    </nav>
  );
}

/** The content of the selected artifact tab. */
function ArtifactTabContent({
  data,
  routeState,
  session,
  navigate,
  onAction,
  onCopy,
  onNotice,
}: {
  data: ArtifactDetailData;
  routeState: ArtifactRouteState;
  session: Session;
  navigate: (path: string) => void;
  onAction: (action: ArtifactDetailAction) => void;
  onCopy: (value: string) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { project, repository, tab } = routeState;
  const artifact = data.artifact;
  const context: ArtifactActionContext = { project, repository, artifact };
  const openReference = (reference: string) =>
    navigate(artifactPath(routeState, { reference, tab: "overview", page: 1 }));
  const changePage = (page: number) =>
    navigate(artifactPath(routeState, { page }));

  if (tab === "tags") {
    return (
      <ArtifactTagsSection
        artifact={artifact}
        project={project}
        repository={repository}
        instanceUrl={session.instance_url}
        collection={data.tags ?? emptyCollection()}
        onAdd={() => onAction({ ...context, kind: "add-tag" })}
        onCopy={onCopy}
        onDelete={(tag) => onAction({ ...context, kind: "delete-tag", tag })}
        onPageChange={changePage}
      />
    );
  }
  if (tab === "labels") {
    const labels = data.labels ?? {
      attached: artifact.labels ?? [],
      available: [],
    };
    const attachedIds = new Set(labels.attached.map(({ id }) => String(id)));
    const attachable = labels.available.filter(
      ({ id }) => !attachedIds.has(String(id)),
    );
    return (
      <ArtifactLabelsSection
        collection={labels}
        onAttach={() => {
          if (!attachable.length) {
            onNotice("没有可绑定的项目或全局标签", true);
            return;
          }
          onAction({ ...context, kind: "attach-label", labels: attachable });
        }}
        onRemove={(label) =>
          onAction({ ...context, kind: "remove-label", label })
        }
      />
    );
  }
  if (tab === "vulnerabilities") {
    return (
      <ArtifactVulnerabilitiesSection
        report={data.vulnerabilities}
        loadError={data.vulnerabilityError}
        notScanned={data.notScanned}
      />
    );
  }
  if (tab === "accessories") {
    return (
      <ArtifactAccessoriesSection
        collection={data.accessories ?? emptyCollection()}
        loadError={data.accessoryError}
        onOpen={(accessory) => openReference(accessory.digest)}
        onCopy={onCopy}
        onDelete={(accessory) =>
          onAction({ ...context, kind: "delete-accessory", accessory })
        }
        onPageChange={changePage}
      />
    );
  }
  if (tab in artifactAdditionTabs) {
    const additionTab = tab as keyof typeof artifactAdditionTabs;
    const addition = artifactAdditionTabs[additionTab];
    const text = artifactAdditionText(data.addition);
    return (
      <ArtifactAdditionSection
        tab={additionTab}
        value={data.addition}
        loadError={data.additionError}
        onCopy={() => onCopy(text)}
        onDownload={() => {
          downloadText(
            text,
            `${sanitizedFilenamePart(project)}-${sanitizedFilenamePart(repository)}-${addition.addition}`,
          );
          onNotice(`${addition.label} 已下载`);
        }}
      />
    );
  }
  return (
    <ArtifactOverviewSection
      artifact={artifact}
      project={project}
      repository={repository}
      instanceUrl={session.instance_url}
      onCopy={onCopy}
      onOpenChild={openReference}
    />
  );
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
  const { data, loading, error, reload } = useArtifactDetail(routeState);

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
        { label: "项目中心", href: "#/projects" },
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
      <ErrorView
        title="制品详情载入失败"
        message={error || t("制品不存在")}
        retry={reload}
      />
    );
  }

  const artifact = data.artifact;
  const title = artifact.tags?.[0]?.name ?? shortDigest(artifact.digest);
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
              onRefresh={() => {
                void onRefresh().then(reload);
              }}
            />
            <ArtifactHeaderActions
              context={{ project, repository, artifact }}
              onAction={onAction}
            />
          </div>
        }
      />
      {session.demo ? <DemoBanner /> : null}
      <ArtifactIdentity
        artifact={artifact}
        onCopy={(value) => void copyValue(value)}
      />
      <ArtifactStats artifact={artifact} />
      <ArtifactTabs artifact={artifact} routeState={routeState} />
      <ContentTransition mode={routeState.tab}>
        <ArtifactTabContent
          data={data}
          routeState={routeState}
          session={session}
          navigate={navigate}
          onAction={onAction}
          onCopy={(value) => void copyValue(value)}
          onNotice={onNotice}
        />
      </ContentTransition>
    </>
  );
}
