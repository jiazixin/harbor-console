import { useState } from "react";
import { describeDashboardWarning } from "../../app/api-errors";
import { useLocale } from "../../app/locale-context";
import type {
  Dashboard,
  ReplicationExecution,
  ReplicationPolicy,
  Session,
} from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { DemoBanner } from "../../components/demo-banner";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { PageHeader } from "../../components/page-header";
import { RefreshButton } from "../../components/refresh-button";
import {
  default as sharedPrimitiveStyles,
  default as uiStyles0,
} from "../../components/shared-ui.module.css";
import { StatCell } from "../../components/stat-cell";
import { StatusBadge } from "../../components/status-badge";
import { triggerLabel } from "../../components/status-badge-support";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatNumber,
  instanceHost,
} from "../../lib/format/formatters";
import styles from "./overview.module.css";

type AssetMetricName = "storage" | "repositories" | "images";

type RiskRingProps = { demo: boolean };

function RiskRing({ demo }: RiskRingProps) {
  const { locale, t } = useLocale();
  const risks = demo
    ? { critical: 3, high: 12, medium: 28, total: 156 }
    : { critical: 0, high: 0, medium: 0, total: 0 };
  const percent = (value: number) =>
    risks.total ? Math.min(100, (value / risks.total) * 100) : 0;
  const critical = percent(risks.critical);
  const high = percent(risks.high);
  const medium = percent(risks.medium);
  const rows = [
    ["严重", "critical", risks.critical],
    ["高危", "high", risks.high],
    ["中危", "medium", risks.medium],
    [
      "其他",
      "",
      Math.max(0, risks.total - risks.critical - risks.high - risks.medium),
    ],
  ] as const;
  return (
    <div className={resolveClasses(styles.riskLayout)}>
      <div
        className={resolveClasses(styles.riskRing)}
        role="img"
        aria-label={`${t("漏洞风险")}：${t("严重")} ${formatNumber(risks.critical, locale)}，${t("高危")} ${formatNumber(risks.high, locale)}，${t("中危")} ${formatNumber(risks.medium, locale)}`}
      >
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle
            className={resolveClasses(styles.riskRingTrack)}
            cx="60"
            cy="60"
            r="52"
            pathLength="100"
          />
          <circle
            className={resolveClasses(
              `${styles.riskRingSegment} ${styles.riskRingCritical}`,
            )}
            cx="60"
            cy="60"
            r="52"
            pathLength="100"
            strokeDasharray={`${critical.toFixed(2)} ${(100 - critical).toFixed(2)}`}
          />
          <circle
            className={resolveClasses(
              `${styles.riskRingSegment} ${styles.riskRingHigh}`,
            )}
            cx="60"
            cy="60"
            r="52"
            pathLength="100"
            strokeDasharray={`${high.toFixed(2)} ${(100 - high).toFixed(2)}`}
            strokeDashoffset={(-critical).toFixed(2)}
          />
          <circle
            className={resolveClasses(
              `${styles.riskRingSegment} ${styles.riskRingMedium}`,
            )}
            cx="60"
            cy="60"
            r="52"
            pathLength="100"
            strokeDasharray={`${medium.toFixed(2)} ${(100 - medium).toFixed(2)}`}
            strokeDashoffset={(-(critical + high)).toFixed(2)}
          />
        </svg>
        <div className={resolveClasses(styles.riskRingLabel)}>
          <strong>{formatNumber(risks.total, locale)}</strong>
          <span>{t("漏洞总数")}</span>
        </div>
      </div>
      <div className={resolveClasses(styles.riskLegend)}>
        {rows.map(([label, className, value]) => (
          <div className={resolveClasses(styles.legendRow)} key={label}>
            <i className={resolveClasses(className)} />
            <span>{t(label)}</span>
            <strong>{formatNumber(value, locale)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

type ReplicationTableProps = {
  executions: ReplicationExecution[];
  policies: ReplicationPolicy[];
};

function ReplicationTable({ executions, policies }: ReplicationTableProps) {
  const { locale, t } = useLocale();
  const policyNames = new Map(
    policies.map((policy) => [String(policy.id), policy.name]),
  );
  if (!executions.length)
    return (
      <EmptyState
        title="暂无复制记录"
        description="策略执行后，同步结果会显示在这里。"
        icon="refresh"
      />
    );
  return (
    <table>
      <thead>
        <tr>
          <th className={resolveClasses("id-column")}>{t("执行编号")}</th>
          <th>{t("策略")}</th>
          <th className={resolveClasses("table-cell-center")}>
            {t("触发方式")}
          </th>
          <th className={resolveClasses("table-cell-center")}>{t("状态")}</th>
          <th>{t("任务统计")}</th>
          <th className={resolveClasses("table-cell-time")}>{t("开始时间")}</th>
          <th className={resolveClasses("table-cell-time")}>{t("耗时")}</th>
        </tr>
      </thead>
      <tbody>
        {executions.map((item) => {
          const policy =
            policyNames.get(String(item.policy_id)) ??
            `${t("策略")} #${
              item.policy_id === undefined ? "-" : String(item.policy_id)
            }`;
          return (
            <tr key={item.id}>
              <td className={resolveClasses("id-cell")}>#{item.id}</td>
              <td>
                <div
                  className={resolveClasses(
                    "replication-execution-policy-cell",
                  )}
                >
                  <strong
                    className={resolveClasses("replication-execution-policy")}
                    title={policy}
                  >
                    {policy}
                  </strong>
                </div>
              </td>
              <td className={resolveClasses("table-cell-center")}>
                {triggerLabel(item.trigger, t)}
              </td>
              <td className={resolveClasses("table-cell-center")}>
                <StatusBadge status={item.status} />
              </td>
              <td>
                <span className={resolveClasses("execution-counts")}>
                  <b className={resolveClasses("success-text")}>
                    {formatNumber(item.succeed, locale)}
                  </b>
                  <b className={resolveClasses("danger-text")}>
                    {formatNumber(item.failed, locale)}
                  </b>
                  <span>{formatNumber(item.in_progress, locale)}</span>
                </span>
              </td>
              <td className={resolveClasses("table-cell-time")}>
                {formatDate(item.start_time, {
                  locale: locale,
                  timeZone: displayTimeZone(),
                })}
              </td>
              <td className={resolveClasses("table-cell-time")}>
                {formatDuration(item.start_time, item.end_time, locale)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

type OverviewPageProps = {
  session: Session;
  dashboard: Dashboard;
  refreshing: boolean;
  onRefresh: () => void;
};

export function OverviewPage({
  session,
  dashboard,
  refreshing,
  onRefresh,
}: OverviewPageProps) {
  const { locale, t } = useLocale();
  const [assetSort, setAssetSort] = useState<AssetMetricName>("storage");
  const projects = dashboard.projects ?? [];
  const statistics = dashboard.statistics ?? {};
  const hasTagCounts = projects.some(
    (project) => project.tag_count !== undefined,
  );
  const metrics = (() => ({
    storage: {
      key: "storage_used" as const,
      label: "存储占用",
      subtitle: "按项目存储占用排序",
      format: (value: number) => formatBytes(value, locale),
    },
    repositories: {
      key: "repo_count" as const,
      label: "仓库数量",
      subtitle: "按镜像仓库数量排序",
      format: (value: number) => formatNumber(value, locale),
    },
    images: {
      key: hasTagCounts ? ("tag_count" as const) : ("artifact_count" as const),
      label: hasTagCounts ? "Tag 数量" : "制品数量",
      subtitle: hasTagCounts ? "按镜像 Tag 数量排序" : "按镜像制品数量排序",
      format: (value: number) => formatNumber(value, locale),
    },
  }))();
  const metric = metrics[assetSort];
  const valueFor = (project: (typeof projects)[number]) => {
    const value = project[metric.key];
    return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : null;
  };
  const sorted = [...projects].sort(
    (left, right) =>
      (valueFor(right) ?? -1) - (valueFor(left) ?? -1) ||
      left.name.localeCompare(right.name, locale),
  );
  const max = Math.max(
    ...sorted.map(valueFor).filter((value): value is number => value !== null),
    0,
  );
  const healthy = dashboard.health?.status?.toLowerCase() === "healthy";
  return (
    <>
      <PageHeader
        title="实例概览"
        subtitle={
          <>
            {instanceHost(session.instance_url)} ·{" "}
            {dashboard.systeminfo?.harbor_version ?? "Harbor v2"}
          </>
        }
        actions={
          <RefreshButton refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
      {session.demo ? <DemoBanner /> : null}
      {(dashboard.warnings ?? []).map((warning) => (
        <div
          className={resolveClasses("notice notice-warning")}
          key={`${warning.source}:${warning.code}`}
        >
          <Icon name="alert" />
          <span>
            <strong>{t("部分数据未载入。")}</strong>{" "}
            {describeDashboardWarning(warning, locale)}
          </span>
        </div>
      ))}
      <section
        className={resolveClasses("overview-stats")}
        aria-label={t("实例统计")}
      >
        <StatCell
          label={t("项目总数")}
          value={formatNumber(
            statistics.total_project_count ?? projects.length,
            locale,
          )}
          foot={`${formatNumber(statistics.private_project_count, locale)} ${locale === "en-US" ? "private projects" : "个私有项目"}`}
          icon="folder"
        />
        <StatCell
          label={t("镜像仓库")}
          value={formatNumber(statistics.total_repo_count, locale)}
          foot={`${formatNumber(statistics.public_repo_count, locale)} ${locale === "en-US" ? "public repositories" : "个公开仓库"}`}
          icon="package"
        />
        <StatCell
          label={t("存储用量")}
          value={formatBytes(statistics.total_storage_consumption, locale)}
          foot={t("当前制品占用空间")}
          icon="database"
        />
        <StatCell
          label={t("系统状态")}
          value={t(healthy ? "正常" : "异常")}
          foot={t(healthy ? "所有核心组件可用" : "请检查组件状态")}
          icon="shield"
        />
      </section>
      <div className={resolveClasses(styles.dashboardGrid)}>
        <section className={resolveClasses("panel")}>
          <div className={resolveClasses("panel-head")}>
            <div>
              <h2>{t("项目资产分布")}</h2>
              <p>{t(metric.subtitle)}</p>
            </div>
            <div className={resolveClasses(styles.panelActions)}>
              <UnifiedSelect
                ariaLabel={t("项目资产排序")}
                className={resolveClasses("toolbar-select")}
                value={assetSort}
                onChange={setAssetSort}
                options={[
                  { value: "storage", label: t("存储占用") },
                  { value: "repositories", label: t("仓库数量") },
                  { value: "images", label: t(metrics.images.label) },
                ]}
              />
              <a className={resolveClasses(styles.panelLink)} href="#/projects">
                {t("查看全部")} <Icon name="arrow-right" />
              </a>
            </div>
          </div>
          <div className={resolveClasses(styles.assetChart)}>
            {sorted.length ? (
              sorted.slice(0, 6).map((project) => {
                const value = valueFor(project);
                const label =
                  value === null ? t("暂无数据") : metric.format(value);
                return (
                  <div
                    className={resolveClasses(styles.assetRow)}
                    key={project.name}
                  >
                    <span title={project.name}>{project.name}</span>
                    {value === null ? (
                      <div
                        className={resolveClasses(
                          `${styles.barTrack} ${styles.barTrackUnavailable}`,
                        )}
                        role="img"
                        aria-label={`${project.name} ${t(metric.label)}${t("暂无数据")}`}
                      />
                    ) : (
                      <progress
                        className={resolveClasses(styles.barTrack)}
                        max={max || 1}
                        value={value}
                        aria-label={`${project.name} ${t(metric.label)}`}
                      >
                        {label}
                      </progress>
                    )}
                    <strong
                      className={resolveClasses(
                        value === null ? styles.assetValueUnavailable : "",
                      )}
                    >
                      {label}
                    </strong>
                  </div>
                );
              })
            ) : (
              <div className={resolveClasses("muted")}>{t("暂无项目数据")}</div>
            )}
          </div>
        </section>
        <section className={resolveClasses(`panel ${styles.riskPanel}`)}>
          <div className={resolveClasses("panel-head")}>
            <div>
              <h2>{t("漏洞风险")}</h2>
              <p>{t(session.demo ? "最近扫描制品汇总" : "查看扫描结果")}</p>
            </div>
            <a className={resolveClasses(styles.panelLink)} href="#/security">
              {t("查看详情")} <Icon name="arrow-right" />
            </a>
          </div>
          <RiskRing demo={session.demo} />
        </section>
      </div>
      <section className={resolveClasses(styles.sectionBlock)}>
        <div className={resolveClasses("section-heading")}>
          <div>
            <h2>{t("最近复制活动")}</h2>
            <p>{t("实例间镜像同步执行记录")}</p>
          </div>
          <a className={resolveClasses(styles.panelLink)} href="#/replication">
            {t("打开复制管理")} <Icon name="arrow-right" />
          </a>
        </div>
        <div className={resolveClasses("table-shell")}>
          <div className={resolveClasses("table-scroll")}>
            <ReplicationTable
              executions={(dashboard.replications ?? []).slice(0, 6)}
              policies={dashboard.replication_policies ?? []}
            />
          </div>
        </div>
      </section>
    </>
  );
}

const resolveClasses = createClassNames({
  critical: sharedPrimitiveStyles.critical,
  high: sharedPrimitiveStyles.high,
  medium: sharedPrimitiveStyles.medium,
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "page-header": uiStyles0.pageHeader,
  "refresh-button": uiStyles0.refreshButton,
  "stat-cell": uiStyles0.statCell,
  "status-badge": uiStyles0.statusBadge,
  "unified-select": uiStyles0.unifiedSelect,
  "id-column": uiStyles0.idColumn,
  "table-cell-center": uiStyles0.tableCellCenter,
  "table-cell-time": uiStyles0.tableCellTime,
  "id-cell": uiStyles0.idCell,
  "replication-execution-policy-cell": uiStyles0.replicationExecutionPolicyCell,
  "replication-execution-policy": uiStyles0.replicationExecutionPolicy,
  "execution-counts": uiStyles0.executionCounts,
  "success-text": uiStyles0.successText,
  "danger-text": uiStyles0.dangerText,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  "overview-stats": uiStyles0.overviewStats,
  panel: uiStyles0.panel,
  "panel-head": uiStyles0.panelHead,
  "toolbar-select": uiStyles0.toolbarSelect,
  muted: uiStyles0.muted,
  "section-heading": uiStyles0.sectionHeading,
  "table-shell": uiStyles0.tableShell,
  "table-scroll": uiStyles0.tableScroll,
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
