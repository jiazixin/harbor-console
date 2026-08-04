import { useEffect, useMemo, useState } from "react";

import {
  formatBytes,
  formatDate,
  formatDuration,
  formatNumber,
  instanceHost,
} from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  Dashboard,
  ReplicationExecution,
  ReplicationPolicy,
  Session,
} from "../../app/models";
import { Icon } from "../../components/icons";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
  StatCell,
} from "../../components/page-elements";
import { UnifiedSelect } from "../../components/unified-select";
import { StatusBadge, triggerLabel } from "../../components/status-badge";

type AssetMetricName = "storage" | "repositories" | "images";

function RiskRing({ demo }: { demo: boolean }) {
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
    <div className="risk-layout">
      <div
        className="risk-ring"
        role="img"
        aria-label={`${t("漏洞风险")}：${t("严重")} ${formatNumber(risks.critical, locale)}，${t("高危")} ${formatNumber(risks.high, locale)}，${t("中危")} ${formatNumber(risks.medium, locale)}`}
      >
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle
            className="risk-ring-track"
            cx="60"
            cy="60"
            r="52"
            pathLength="100"
          />
          <circle
            className="risk-ring-segment risk-ring-critical"
            cx="60"
            cy="60"
            r="52"
            pathLength="100"
            strokeDasharray={`${critical.toFixed(2)} ${(100 - critical).toFixed(2)}`}
          />
          <circle
            className="risk-ring-segment risk-ring-high"
            cx="60"
            cy="60"
            r="52"
            pathLength="100"
            strokeDasharray={`${high.toFixed(2)} ${(100 - high).toFixed(2)}`}
            strokeDashoffset={(-critical).toFixed(2)}
          />
          <circle
            className="risk-ring-segment risk-ring-medium"
            cx="60"
            cy="60"
            r="52"
            pathLength="100"
            strokeDasharray={`${medium.toFixed(2)} ${(100 - medium).toFixed(2)}`}
            strokeDashoffset={(-(critical + high)).toFixed(2)}
          />
        </svg>
        <div className="risk-ring-label">
          <strong>{formatNumber(risks.total, locale)}</strong>
          <span>{t("漏洞总数")}</span>
        </div>
      </div>
      <div className="risk-legend">
        {rows.map(([label, className, value]) => (
          <div className="legend-row" key={label}>
            <i className={className} />
            <span>{t(label)}</span>
            <strong>{formatNumber(value, locale)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyReplicationTable() {
  const { t } = useLocale();
  return (
    <div className="empty-state">
      <div>
        <span className="state-icon">
          <Icon name="refresh" />
        </span>
        <h2>{t("暂无复制记录")}</h2>
        <p>{t("策略执行后，同步结果会显示在这里。")}</p>
      </div>
    </div>
  );
}

function ReplicationTable({
  executions,
  policies,
}: {
  executions: ReplicationExecution[];
  policies: ReplicationPolicy[];
}) {
  const { locale, t } = useLocale();
  const policyNames = new Map(
    policies.map((policy) => [String(policy.id), policy.name]),
  );
  if (!executions.length) return <EmptyReplicationTable />;
  return (
    <table>
      <thead>
        <tr>
          <th className="id-column">{t("执行编号")}</th>
          <th>{t("策略")}</th>
          <th className="table-cell-center">{t("触发方式")}</th>
          <th className="table-cell-center">{t("状态")}</th>
          <th>{t("任务统计")}</th>
          <th className="table-cell-time">{t("开始时间")}</th>
          <th>{t("耗时")}</th>
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
              <td className="id-cell">#{item.id}</td>
              <td>
                <div className="replication-execution-policy-cell">
                  <strong
                    className="replication-execution-policy"
                    title={policy}
                  >
                    {policy}
                  </strong>
                </div>
              </td>
              <td className="table-cell-center">
                {triggerLabel(item.trigger, t)}
              </td>
              <td className="table-cell-center">
                <StatusBadge status={item.status} />
              </td>
              <td>
                <span className="execution-counts">
                  <b className="success-text">
                    {formatNumber(item.succeed, locale)}
                  </b>
                  <b className="danger-text">
                    {formatNumber(item.failed, locale)}
                  </b>
                  <span>{formatNumber(item.in_progress, locale)}</span>
                </span>
              </td>
              <td className="table-cell-time">
                {formatDate(item.start_time, locale)}
              </td>
              <td>{formatDuration(item.start_time, item.end_time, locale)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function OverviewPage({
  session,
  dashboard,
  refreshing,
  onRefresh,
}: {
  session: Session;
  dashboard: Dashboard;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { locale, t } = useLocale();
  const [assetSort, setAssetSort] = useState<AssetMetricName>("storage");
  const [entering, setEntering] = useState(true);
  const projects = dashboard.projects ?? [];
  const statistics = dashboard.statistics ?? {};
  const hasTagCounts = projects.some(
    (project) => project.tag_count !== undefined,
  );
  const metrics = useMemo(
    () => ({
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
        key: hasTagCounts
          ? ("tag_count" as const)
          : ("artifact_count" as const),
        label: hasTagCounts ? "Tag 数量" : "制品数量",
        subtitle: hasTagCounts ? "按镜像 Tag 数量排序" : "按镜像制品数量排序",
        format: (value: number) => formatNumber(value, locale),
      },
    }),
    [hasTagCounts, locale],
  );
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
  const motionClass = entering ? " motion-route-enter" : "";

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntering(false);
      return;
    }
    const timer = window.setTimeout(() => setEntering(false), 380);
    return () => window.clearTimeout(timer);
  }, []);

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
        motionClass={motionClass}
        actions={
          <RefreshButton refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
      {session.demo ? <DemoBanner motionClass={motionClass} /> : null}
      {(dashboard.warnings ?? []).map((warning) => (
        <div className={`warning-banner${motionClass}`} key={warning}>
          <Icon name="alert" />
          <span>
            <strong>{t("部分数据未载入。")}</strong> {warning}
          </span>
        </div>
      ))}
      <section
        className={`overview-stats${motionClass}`}
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
      <div className={`dashboard-grid${motionClass}`}>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>{t("项目资产分布")}</h2>
              <p>{t(metric.subtitle)}</p>
            </div>
            <div className="panel-actions">
              <UnifiedSelect
                ariaLabel={t("项目资产排序")}
                className="toolbar-select"
                value={assetSort}
                onChange={setAssetSort}
                options={[
                  { value: "storage", label: t("存储占用") },
                  { value: "repositories", label: t("仓库数量") },
                  { value: "images", label: t(metrics.images.label) },
                ]}
              />
              <a className="panel-link" href="#/projects">
                {t("查看全部")} <Icon name="arrow-right" />
              </a>
            </div>
          </div>
          <div className="asset-chart">
            {sorted.length ? (
              sorted.slice(0, 6).map((project) => {
                const value = valueFor(project);
                const label =
                  value === null ? t("暂无数据") : metric.format(value);
                return (
                  <div className="asset-row" key={project.name}>
                    <span title={project.name}>{project.name}</span>
                    {value === null ? (
                      <div
                        className="bar-track bar-track-unavailable"
                        role="img"
                        aria-label={`${project.name} ${t(metric.label)}${t("暂无数据")}`}
                      />
                    ) : (
                      <progress
                        className="bar-track"
                        max={max || 1}
                        value={value}
                        aria-label={`${project.name} ${t(metric.label)}`}
                      >
                        {label}
                      </progress>
                    )}
                    <strong
                      className={
                        value === null ? "asset-value-unavailable" : ""
                      }
                    >
                      {label}
                    </strong>
                  </div>
                );
              })
            ) : (
              <div className="muted">{t("暂无项目数据")}</div>
            )}
          </div>
        </section>
        <section className="panel risk-panel">
          <div className="panel-head">
            <div>
              <h2>{t("漏洞风险")}</h2>
              <p>{t(session.demo ? "最近扫描制品汇总" : "查看扫描结果")}</p>
            </div>
            <a className="panel-link" href="#/security">
              {t("查看详情")} <Icon name="arrow-right" />
            </a>
          </div>
          <RiskRing demo={session.demo} />
        </section>
      </div>
      <section className={`section-block${motionClass}`}>
        <div className="section-heading">
          <div>
            <h2>{t("最近复制活动")}</h2>
            <p>{t("实例间镜像同步执行记录")}</p>
          </div>
          <a className="panel-link" href="#/replication">
            {t("打开复制管理")} <Icon name="arrow-right" />
          </a>
        </div>
        <div className="table-shell">
          <div className="table-scroll">
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
