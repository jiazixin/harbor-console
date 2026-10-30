import { useRef } from "react";
import type { ConsoleRoute } from "../../app/console-route";
import { downloadText } from "../../app/download-text";
import { useLocale } from "../../app/locale-context";
import type { HarborArtifact, Session } from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { Breadcrumb } from "../../components/breadcrumb";
import { ContentTransition } from "../../components/content-transition";
import { DemoBanner } from "../../components/demo-banner";
import { ErrorView } from "../../components/error-view";
import { Icon } from "../../components/icon";
import { PageHeader } from "../../components/page-header";
import { RefreshButton } from "../../components/refresh-button";
import {
  default as sharedPrimitiveStyles,
  default as uiStyles0,
} from "../../components/shared-ui.module.css";
import { StatCell } from "../../components/stat-cell";
import { severityLabel } from "../../components/status-badge-support";
import { useCenterActiveTab } from "../../components/use-center-active-tab";
import { createClassNames } from "../../lib/css/class-names";
import {
  formatBytes,
  formatDate,
  formatNumber,
} from "../../lib/format/formatters";
import { ArtifactAccessoriesSection } from "./artifact-accessories-section";
import { ArtifactAdditionSection } from "./artifact-addition-section";
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
  artifactAdditionTabs,
  artifactAdditionText,
  artifactHasAddition,
  LabelChip,
} from "./artifact-detail-sections-support";
import { ArtifactLabelsSection } from "./artifact-labels-section";
import { ArtifactOverviewSection } from "./artifact-overview-section";
import { ArtifactTagsSection } from "./artifact-tags-section";
import {
  artifactArchitectureSummary,
  artifactScanState,
  isStoppableScanStatus,
  repositoryDisplayName,
  shortDigest,
} from "./artifact-utils";
import { ArtifactVulnerabilitiesSection } from "./artifact-vulnerabilities-section";
import styles from "./artifacts.module.css";

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

type ArtifactHeaderActionsProps = {
  context: ArtifactActionContext;
  onAction: (action: ArtifactDetailAction) => void;
};

function ArtifactHeaderActions({
  context,
  onAction,
}: ArtifactHeaderActionsProps) {
  const { t } = useLocale();
  const scan = artifactScanState(context.artifact);
  const sbom = artifactScanState(context.artifact, "sbom");
  const runningScan = (() => {
    if (isStoppableScanStatus(scan.status)) {
      return "vulnerability" as const;
    }
    if (isStoppableScanStatus(sbom.status)) {
      return "sbom" as const;
    }
    return undefined;
  })();
  return (
    <>
      {scan.reportId ? (
        <button
          className={resolveClasses("button button-small")}
          type="button"
          onClick={() => {
            onAction({ ...context, kind: "scan-log", reportId: scan.reportId });
          }}
        >
          <Icon name="terminal" />
          <span>{t("扫描日志")}</span>
        </button>
      ) : null}
      {runningScan ? (
        <button
          className={resolveClasses("button button-small button-danger")}
          type="button"
          onClick={() => {
            onAction({ ...context, kind: "stop-scan", scanType: runningScan });
          }}
        >
          <Icon name="x" />
          <span>{t(runningScan === "sbom" ? "停止 SBOM" : "停止扫描")}</span>
        </button>
      ) : null}
      <button
        className={resolveClasses("button button-small")}
        type="button"
        onClick={() => {
          onAction({ ...context, kind: "scan" });
        }}
      >
        <Icon name="shield" />
        <span>{t("扫描 / SBOM")}</span>
      </button>
      <button
        className={resolveClasses("button button-small")}
        type="button"
        onClick={() => {
          onAction({ ...context, kind: "copy" });
        }}
      >
        <Icon name="copy" />
        <span>{t("复制制品")}</span>
      </button>
      <button
        className={resolveClasses("button button-small")}
        type="button"
        onClick={() => {
          onAction({ ...context, kind: "add-tag" });
        }}
      >
        <Icon name="tag" />
        <span>{t("添加 Tag")}</span>
      </button>
      <button
        className={resolveClasses("button button-small button-danger")}
        type="button"
        onClick={() => {
          onAction({ ...context, kind: "delete" });
        }}
      >
        <Icon name="trash" />
        <span>{t("删除制品")}</span>
      </button>
    </>
  );
}

type ArtifactIdentityProps = {
  artifact: HarborArtifact;
  onCopy: (value: string) => void;
};

function ArtifactIdentity({ artifact, onCopy }: ArtifactIdentityProps) {
  const { t } = useLocale();
  return (
    <section className={resolveClasses(styles.artifactIdentity)}>
      <div>
        <span className={resolveClasses("eyebrow")}>{t("制品摘要")}</span>
        <strong className={resolveClasses(`mono ${styles.digestFull}`)}>
          {artifact.digest}
        </strong>
        {artifact.labels?.length ? (
          <span className={resolveClasses(styles.artifactIdentityLabels)}>
            {artifact.labels.map((label) => (
              <LabelChip key={label.id} label={label} />
            ))}
          </span>
        ) : null}
      </div>
      <button
        className={resolveClasses("button button-small")}
        type="button"
        onClick={() => {
          onCopy(artifact.digest);
        }}
      >
        <Icon name="copy" />
        <span>{t("复制摘要")}</span>
      </button>
    </section>
  );
}

type ArtifactStatsProps = { artifact: HarborArtifact };

function ArtifactStats({ artifact }: ArtifactStatsProps) {
  const { locale, t } = useLocale();
  const scan = artifactScanState(artifact);
  const highestRisk = t(severityLabel(scan.severity));
  return (
    <section
      className={resolveClasses("overview-stats project-stats")}
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
        value={formatDate(artifact.push_time, {
          locale: locale,
          timeZone: displayTimeZone(),
          includeTime: false,
        })}
        foot={formatDate(artifact.push_time, {
          locale: locale,
          timeZone: displayTimeZone(),
        })}
        icon="history"
      />
    </section>
  );
}

type ArtifactTabsProps = {
  artifact: HarborArtifact;
  routeState: ArtifactRouteState;
};

function ArtifactTabs({ artifact, routeState }: ArtifactTabsProps) {
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
      className={resolveClasses(`resource-tabs ${styles.artifactTabs}`)}
      aria-label={t("制品页面")}
    >
      {visibleTabs.map((tab) => (
        <a
          key={tab.key}
          href={`#/${artifactPath(routeState, { tab: tab.key, page: 1 })}`}
          className={resolveClasses(
            routeState.tab === tab.key ? "active" : undefined,
          )}
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
type ArtifactTabContentProps = {
  data: ArtifactDetailData;
  routeState: ArtifactRouteState;
  session: Session;
  navigate: (path: string) => void;
  onAction: (action: ArtifactDetailAction) => void;
  onCopy: (value: string) => void;
  onNotice: (message: string, error?: boolean) => void;
};

function ArtifactTabContent({
  data,
  routeState,
  session,
  navigate,
  onAction,
  onCopy,
  onNotice,
}: ArtifactTabContentProps) {
  const { project, repository, tab } = routeState;
  const artifact = data.artifact;
  const context: ArtifactActionContext = { project, repository, artifact };
  const openReference = (reference: string) => {
    navigate(artifactPath(routeState, { reference, tab: "overview", page: 1 }));
  };
  const changePage = (page: number) => {
    navigate(artifactPath(routeState, { page }));
  };

  if (tab === "tags") {
    return (
      <ArtifactTagsSection
        artifact={artifact}
        project={project}
        repository={repository}
        instanceUrl={session.instance_url}
        collection={data.tags ?? emptyCollection()}
        onAdd={() => {
          onAction({ ...context, kind: "add-tag" });
        }}
        onCopy={onCopy}
        onDelete={(tag) => {
          onAction({ ...context, kind: "delete-tag", tag });
        }}
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
        onRemove={(label) => {
          onAction({ ...context, kind: "remove-label", label });
        }}
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
        onOpen={(accessory) => {
          openReference(accessory.digest);
        }}
        onCopy={onCopy}
        onDelete={(accessory) => {
          onAction({ ...context, kind: "delete-accessory", accessory });
        }}
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
        onCopy={() => {
          onCopy(text);
        }}
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

type ArtifactDetailPageProps = {
  route: ConsoleRoute;
  session: Session;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => Promise<void>;
  onAction: (action: ArtifactDetailAction) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function ArtifactDetailPage({
  route,
  session,
  refreshing,
  navigate,
  onRefresh,
  onAction,
  onNotice,
}: ArtifactDetailPageProps) {
  const { locale, t } = useLocale();
  const project = route.segments[1] ?? "";
  const repository = route.segments[3] ?? "";
  const reference = route.segments[5] ?? "";
  const tabValue = route.query.get("tab");
  const pageValue = route.query.get("page");
  const routeState = ((): ArtifactRouteState =>
    (() => ({
      project,
      repository,
      reference,
      tab: artifactTab(tabValue),
      page: positiveInteger(pageValue),
    }))())();
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
        <section className={resolveClasses("table-shell")}>
          <div className={resolveClasses("loading-state")}>
            <div>
              <span className={resolveClasses("spinner")} />
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
          <div className={resolveClasses(styles.artifactDetailActions)}>
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

const resolveClasses = createClassNames({
  critical: sharedPrimitiveStyles.critical,
  high: sharedPrimitiveStyles.high,
  breadcrumb: uiStyles0.breadcrumb,
  icon: uiStyles0.icon,
  "page-header": uiStyles0.pageHeader,
  "refresh-button": uiStyles0.refreshButton,
  "stat-cell": uiStyles0.statCell,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-danger": uiStyles0.buttonDanger,
  tag: uiStyles0.tag,
  eyebrow: uiStyles0.eyebrow,
  mono: uiStyles0.mono,
  "overview-stats": uiStyles0.overviewStats,
  "resource-tabs": uiStyles0.resourceTabs,
  active: uiStyles0.active,
  "table-shell": uiStyles0.tableShell,
  "loading-state": uiStyles0.loadingState,
  spinner: uiStyles0.spinner,
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
