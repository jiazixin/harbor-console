import { type SubmitEvent } from "react";
import { controlApi } from "../../app/api-client";
import type { ConsoleRoute } from "../../app/console-route";
import { errorText } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type {
  ControlList,
  CveAllowlist,
  CveExportExecution,
  ProjectSummary,
  ScannerRegistration,
  SecurityDangerousArtifact,
  SecuritySummary,
  SecurityVulnerability,
} from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { useControlMutation } from "../../app/use-control-mutation";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { ContentTransition } from "../../components/content-transition";
import { DemoBanner } from "../../components/demo-banner";
import { EmptyState } from "../../components/empty-state";
import { ErrorView } from "../../components/error-view";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import { PageHeader } from "../../components/page-header";
import { Pagination } from "../../components/pagination";
import { PanelTitle } from "../../components/panel-title";
import { RefreshButton } from "../../components/refresh-button";
import { SeverityBadge } from "../../components/severity-badge";
import {
  default as sharedPrimitiveStyles,
  default as uiStyles0,
} from "../../components/shared-ui.module.css";
import { StatCell } from "../../components/stat-cell";
import { StatusBadge } from "../../components/status-badge";
import { triggerLabel } from "../../components/status-badge-support";
import { ToolbarSearchForm } from "../../components/toolbar-search-form";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import {
  formatCount,
  formatDate,
  formatDecimal,
  formatDuration,
  formatNumber,
} from "../../lib/format/formatters";
import { useResettableState } from "../../lib/state/use-resettable-state";
import { shortDigest } from "../artifacts/public";
import { securityKeys } from "./security-keys";
import styles from "./security.module.css";

// Queries that a write in this module can change.
const affectedQueries = [securityKeys.all];

export type SecurityAction =
  | { kind: "create-scanner"; canDisable: boolean }
  | { kind: "edit-scanner"; scanner: ScannerRegistration }
  | { kind: "scanner-metadata"; scanner: ScannerRegistration }
  | { kind: "delete-scanner"; scanner: ScannerRegistration }
  | { kind: "edit-allowlist"; allowlist: CveAllowlist }
  | { kind: "create-export"; projects: ProjectSummary[] }
  | { kind: "export-detail"; execution: CveExportExecution };

type SecuritySection =
  "allowlist" | "exports" | "overview" | "scanners" | "vulnerabilities";

type SectionData =
  | { section: "allowlist"; allowlist: CveAllowlist }
  | { section: "exports"; executions: CveExportExecution[] }
  | { section: "overview"; summary: SecuritySummary }
  | { section: "scanners"; scanners: ControlList<ScannerRegistration> }
  | {
      section: "vulnerabilities";
      vulnerabilities: ControlList<SecurityVulnerability>;
    };

const tabs: {
  key: SecuritySection;
  label: string;
  icon: "alert" | "check" | "database" | "shield";
}[] = [
  { key: "overview", label: "风险概览", icon: "shield" },
  { key: "scanners", label: "扫描器", icon: "shield" },
  { key: "vulnerabilities", label: "漏洞明细", icon: "alert" },
  { key: "exports", label: "CVE 导出", icon: "database" },
  { key: "allowlist", label: "系统白名单", icon: "check" },
];

function sectionFromRoute(route: ConsoleRoute): SecuritySection {
  const value = route.segments[1];
  return tabs.some((tab) => tab.key === value)
    ? (value as SecuritySection)
    : "overview";
}

function securityPath(
  section: SecuritySection,
  values: Record<string, string | number | undefined> = {},
): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return `security/${section}${query.size ? `?${query}` : ""}`;
}

function vulnerabilityQuery(
  route: ConsoleRoute,
  projects: ProjectSummary[],
): string {
  const clauses: string[] = [];
  const add = (key: string, value: string | number | undefined) => {
    if (String(value ?? "").trim())
      clauses.push(`${key}=${String(value).trim()}`);
  };
  add("cve_id", route.query.get("cve")?.toUpperCase());
  add("severity", route.query.get("severity") ?? "");
  add("status", route.query.get("status") ?? "");
  add("repository_name", route.query.get("repository") ?? "");
  add("package", route.query.get("package") ?? "");
  add("tag", route.query.get("tag") ?? "");
  const project = projects.find(
    (item) => item.name === route.query.get("project"),
  );
  add("project_id", project?.project_id);
  return clauses.join(",");
}

function artifactTarget(
  item: SecurityDangerousArtifact | SecurityVulnerability,
  projects: ProjectSummary[],
): string {
  const repository = item.repository_name ?? "";
  const project =
    projects.find((candidate) => candidate.project_id === item.project_id)
      ?.name ?? repository.split("/")[0];
  if (!project || !repository || !item.digest) return "";
  return `#/projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts/${encodeURIComponent(item.digest)}?tab=vulnerabilities`;
}

type SecurityTabsProps = { selected: SecuritySection };

function SecurityTabs({ selected }: SecurityTabsProps) {
  const { t } = useLocale();
  return (
    <nav
      className={resolveClasses("resource-tabs security-tabs")}
      aria-label={t("安全中心页面")}
    >
      {tabs.map((tab) => (
        <a
          key={tab.key}
          href={`#/${securityPath(tab.key)}`}
          className={resolveClasses(selected === tab.key ? "active" : "")}
          aria-current={selected === tab.key ? "page" : undefined}
        >
          <Icon name={tab.icon} />
          <span>{t(tab.label)}</span>
        </a>
      ))}
    </nav>
  );
}

type RiskProgressProps = {
  label: string;
  value: number;
  total: number;
  critical?: boolean;
};

function RiskProgress({
  label,
  value,
  total,
  critical = false,
}: RiskProgressProps) {
  const { locale, t } = useLocale();
  const width = total
    ? Math.max(value ? 3 : 0, Math.min(100, (value / total) * 100))
    : 0;
  return (
    <div>
      <span>{t(label)}</span>
      <strong>{formatNumber(value, locale)}</strong>
      <progress
        className={resolveClasses(
          `${styles.securityRiskProgress}${critical ? ` ${styles.securityRiskCritical}` : ""}`,
        )}
        max={100}
        value={width}
        aria-label={`${t(label)}${t("漏洞占比")}`}
      />
    </div>
  );
}

type SecurityOverviewProps = {
  summary: SecuritySummary;
  totalArtifacts: number;
  projects: ProjectSummary[];
};

function SecurityOverview({
  summary,
  totalArtifacts,
  projects,
}: SecurityOverviewProps) {
  const { locale, t } = useLocale();
  const scanned = summary.scanned_cnt ?? 0;
  const artifactTotal =
    totalArtifacts > 0 ? totalArtifacts : (summary.total_artifact ?? 0);
  const vulnerabilities = summary.total_vuls ?? 0;
  const coverage = artifactTotal
    ? Math.min(100, (scanned / artifactTotal) * 100)
    : 0;
  const cves = summary.dangerous_cves ?? [];
  const artifacts = [...(summary.dangerous_artifacts ?? [])].sort(
    (left, right) =>
      (right.critical_cnt ?? 0) * 1_000_000 +
      (right.high_cnt ?? 0) * 1_000 +
      (right.medium_cnt ?? 0) -
      ((left.critical_cnt ?? 0) * 1_000_000 +
        (left.high_cnt ?? 0) * 1_000 +
        (left.medium_cnt ?? 0)),
  );
  return (
    <>
      <section
        className={resolveClasses("overview-stats security-stats")}
        aria-label={t("安全统计")}
      >
        <StatCell
          label={t("漏洞总数")}
          value={formatNumber(vulnerabilities, locale)}
          foot={
            locale === "en-US"
              ? `${formatNumber(summary.fixable_cnt, locale)} with fixes available`
              : `${formatNumber(summary.fixable_cnt, locale)} 个已有修复版本`
          }
          icon="shield"
        />
        <StatCell
          label={t("严重漏洞")}
          value={formatNumber(summary.critical_cnt, locale)}
          foot={
            locale === "en-US"
              ? `${formatNumber(summary.high_cnt, locale)} high vulnerabilities`
              : `${formatNumber(summary.high_cnt, locale)} 个高危漏洞`
          }
          icon="alert"
        />
        <StatCell
          label={t("已扫描制品")}
          value={formatNumber(scanned, locale)}
          foot={
            locale === "en-US"
              ? `${formatDecimal(coverage)}% artifact coverage`
              : `覆盖 ${formatDecimal(coverage)}% 的制品`
          }
          icon="check"
        />
        <StatCell
          label={t("未覆盖制品")}
          value={formatNumber(Math.max(0, artifactTotal - scanned), locale)}
          foot={
            locale === "en-US"
              ? `${formatNumber(artifactTotal, locale)} artifacts`
              : `共 ${formatNumber(artifactTotal, locale)} 个制品`
          }
          icon="database"
        />
      </section>
      <section
        className={resolveClasses(styles.securityRiskBand)}
        aria-label={t("风险分布")}
      >
        <RiskProgress
          label="严重"
          value={summary.critical_cnt ?? 0}
          total={vulnerabilities}
          critical
        />
        <RiskProgress
          label="高危"
          value={summary.high_cnt ?? 0}
          total={vulnerabilities}
        />
        <RiskProgress
          label="中危"
          value={summary.medium_cnt ?? 0}
          total={vulnerabilities}
        />
        <RiskProgress
          label="低危"
          value={summary.low_cnt ?? 0}
          total={vulnerabilities}
        />
      </section>
      <div className={resolveClasses(styles.securityOverviewGrid)}>
        <section className={resolveClasses("table-shell")}>
          <div className={resolveClasses("table-toolbar")}>
            <div>
              <strong>{t("高风险 CVE")}</strong>
              <span className={resolveClasses("toolbar-caption")}>
                {t("按 Harbor 风险汇总")}
              </span>
            </div>
            <div className={resolveClasses("toolbar-spacer")} />
            <a
              className={resolveClasses("button button-small")}
              href="#/security/vulnerabilities"
            >
              <Icon name="arrow-right" />
              <span>{t("全部漏洞")}</span>
            </a>
          </div>
          <div className={resolveClasses("table-scroll")}>
            {cves.length ? (
              <table>
                <thead>
                  <tr>
                    <th>CVE</th>
                    <th>{t("风险")}</th>
                    <th>CVSS</th>
                    <th>{t("软件包")}</th>
                    <th>{t("说明")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cves.map((item) => (
                    <tr
                      key={`${item.cve_id ?? "unknown"}-${item.package ?? "unknown"}`}
                    >
                      <td>
                        <strong className={resolveClasses("mono")}>
                          {item.cve_id ?? "-"}
                        </strong>
                      </td>
                      <td>
                        <SeverityBadge severity={item.severity} />
                      </td>
                      <td className={resolveClasses("mono")}>
                        {item.cvss_score_v3 ?? "-"}
                      </td>
                      <td>
                        <span className={resolveClasses("cell-stack")}>
                          <strong>{item.package ?? "-"}</strong>
                          <small>{item.version ?? "-"}</small>
                        </span>
                      </td>
                      <td
                        className={resolveClasses("vulnerability-description")}
                      >
                        {item.desc ? t(item.desc) : "-"}
                      </td>
                      <td>
                        <a
                          className={resolveClasses("icon-button")}
                          href={`#/security/vulnerabilities?cve=${encodeURIComponent(item.cve_id ?? "")}`}
                          title={t("查看此 CVE")}
                          aria-label={`${t("查看此 CVE")} ${item.cve_id ?? ""}`}
                        >
                          <Icon name="chevron" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="没有高风险 CVE"
                description="当前汇总没有返回危险漏洞。"
                icon="shield"
              />
            )}
          </div>
        </section>
        <section className={resolveClasses("table-shell")}>
          <div className={resolveClasses("table-toolbar")}>
            <div>
              <strong>{t("危险制品")}</strong>
              <span className={resolveClasses("toolbar-caption")}>
                {t("按严重、高危与中危数量排序")}
              </span>
            </div>
          </div>
          <div className={resolveClasses("table-scroll")}>
            {artifacts.length ? (
              <table>
                <thead>
                  <tr>
                    <th>{t("制品")}</th>
                    <th>{t("严重")}</th>
                    <th>{t("高危")}</th>
                    <th>{t("中危")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {artifacts.map((item) => {
                    const target = artifactTarget(item, projects);
                    return (
                      <tr key={item.digest}>
                        <td>
                          <span className={resolveClasses("cell-stack")}>
                            <strong>{item.repository_name ?? "-"}</strong>
                            <small
                              className={resolveClasses("mono")}
                              title={item.digest}
                            >
                              {shortDigest(item.digest ?? "")}
                            </small>
                          </span>
                        </td>
                        <td className={resolveClasses("danger-text")}>
                          {formatNumber(item.critical_cnt, locale)}
                        </td>
                        <td>{formatNumber(item.high_cnt, locale)}</td>
                        <td>{formatNumber(item.medium_cnt, locale)}</td>
                        <td>
                          {target ? (
                            <a
                              className={resolveClasses("icon-button")}
                              href={target}
                              title={t("打开制品漏洞")}
                              aria-label={t("打开制品漏洞")}
                            >
                              <Icon name="chevron" />
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="没有危险制品"
                description="当前汇总没有返回高风险制品。"
                icon="package"
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

type VulnerabilityStatusProps = { value: string | undefined };

function VulnerabilityStatus({ value }: VulnerabilityStatusProps) {
  const { t } = useLocale();
  const status = value?.toLowerCase() ?? "";
  const presentation = (() => {
    if (status === "fixed") {
      return ["已有修复", "badge-green"];
    }
    if (status === "will_not_fix" || status === "won't fix") {
      return ["不会修复", "badge-orange"];
    }
    if (status === "not_fixed") {
      return ["暂无修复", ""];
    }
    return [value ?? "未知", ""];
  })();
  return (
    <span className={resolveClasses(`badge ${presentation[1] ?? ""}`.trim())}>
      {t(presentation[0] ?? "未知")}
    </span>
  );
}

type VulnerabilitiesSectionProps = {
  route: ConsoleRoute;
  collection: ControlList<SecurityVulnerability>;
  projects: ProjectSummary[];
  navigate: (path: string) => void;
};

function VulnerabilitiesSection({
  route,
  collection,
  projects,
  navigate,
}: VulnerabilitiesSectionProps) {
  const { t } = useLocale();
  const values = Object.fromEntries(
    [
      "cve",
      "repository",
      "project",
      "severity",
      "status",
      "package",
      "tag",
    ].map((key) => [key, route.query.get(key) ?? ""]),
  );
  const [projectFilter, setProjectFilter] = useResettableState(
    values.project ?? "",
  );
  const [severityFilter, setSeverityFilter] = useResettableState(
    values.severity ?? "",
  );
  const [statusFilter, setStatusFilter] = useResettableState(
    values.status ?? "",
  );
  const active = Object.values(values).some(Boolean);
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    navigate(
      securityPath("vulnerabilities", {
        page: 1,
        page_size: route.query.get("page_size") ?? 50,
        ...Object.fromEntries(
          [...form].map(([key, value]) => [
            key,
            typeof value === "string" ? value : "",
          ]),
        ),
      }),
    );
  }
  return (
    <section
      className={resolveClasses(
        `table-shell ${styles.securityVulnerabilityShell}`,
      )}
    >
      <form
        className={resolveClasses(`table-toolbar ${styles.securityFilterForm}`)}
        onSubmit={submit}
      >
        <label className={resolveClasses("toolbar-search")}>
          <Icon name="search" />
          <FormInput
            name="cve"
            defaultValue={values.cve}
            placeholder={t("CVE 编号")}
            aria-label={t("CVE 编号")}
          />
        </label>
        <label className={resolveClasses("toolbar-search")}>
          <Icon name="package" />
          <FormInput
            name="repository"
            defaultValue={values.repository}
            placeholder={t("完整仓库名称")}
            aria-label={t("完整仓库名称")}
          />
        </label>
        <label className={resolveClasses("toolbar-field")}>
          <span>{t("项目")}</span>
          <UnifiedSelect
            ariaLabel={t("项目")}
            name="project"
            className={resolveClasses("toolbar-select")}
            value={projectFilter}
            options={[
              { value: "", label: t("全部项目") },
              ...projects.map((project) => ({
                value: project.name,
                label: project.name,
              })),
            ]}
            onChange={setProjectFilter}
          />
        </label>
        <label className={resolveClasses("toolbar-field")}>
          <span>{t("风险")}</span>
          <UnifiedSelect
            ariaLabel={t("风险")}
            name="severity"
            className={resolveClasses("toolbar-select")}
            value={severityFilter}
            options={[
              { value: "", label: t("全部风险") },
              { value: "Critical", label: t("严重") },
              { value: "High", label: t("高危") },
              { value: "Medium", label: t("中危") },
              { value: "Low", label: t("低危") },
              { value: "Unknown", label: t("未知") },
            ]}
            onChange={setSeverityFilter}
          />
        </label>
        <label className={resolveClasses("toolbar-field")}>
          <span>{t("修复状态")}</span>
          <UnifiedSelect
            ariaLabel={t("修复状态")}
            name="status"
            className={resolveClasses("toolbar-select")}
            value={statusFilter}
            options={[
              { value: "", label: t("全部状态") },
              { value: "fixed", label: t("已有修复") },
              { value: "will_not_fix", label: t("不会修复") },
            ]}
            onChange={setStatusFilter}
          />
        </label>
        <label
          className={resolveClasses(`toolbar-search ${styles.compactSearch}`)}
        >
          <Icon name="database" />
          <FormInput
            name="package"
            defaultValue={values.package}
            placeholder={t("软件包")}
            aria-label={t("软件包")}
          />
        </label>
        <label
          className={resolveClasses(`toolbar-search ${styles.compactSearch}`)}
        >
          <Icon name="tag" />
          <FormInput
            name="tag"
            defaultValue={values.tag}
            placeholder="Tag"
            aria-label="Tag"
          />
        </label>
        <button
          className={resolveClasses("button button-small button-primary")}
          type="submit"
        >
          <Icon name="search" />
          <span>{t("筛选")}</span>
        </button>
        {active ? (
          <button
            className={resolveClasses("button button-small")}
            type="button"
            onClick={() => {
              navigate(securityPath("vulnerabilities"));
            }}
          >
            <Icon name="x" />
            <span>{t("取消筛选")}</span>
          </button>
        ) : null}
      </form>
      <div className={resolveClasses("table-scroll")}>
        {collection.items.length ? (
          <table>
            <thead>
              <tr>
                <th>CVE</th>
                <th>{t("风险")}</th>
                <th>CVSS</th>
                <th>{t("制品")}</th>
                <th>Tag</th>
                <th>{t("软件包")}</th>
                <th>{t("当前版本")}</th>
                <th>{t("修复版本")}</th>
                <th>{t("状态")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {collection.items.map((item, index) => {
                const target = artifactTarget(item, projects);
                return (
                  <tr
                    key={`${item.cve_id ?? "unknown"}-${item.digest ?? "unknown"}-${String(index)}`}
                  >
                    <td>
                      <span className={resolveClasses("cell-stack")}>
                        <strong className={resolveClasses("mono")}>
                          {item.cve_id ?? "-"}
                        </strong>
                        <small
                          className={resolveClasses(
                            styles.securityVulnerabilityDesc,
                          )}
                          title={item.desc}
                        >
                          {item.desc ? t(item.desc) : t("暂无说明")}
                        </small>
                      </span>
                    </td>
                    <td>
                      <SeverityBadge severity={item.severity} />
                    </td>
                    <td className={resolveClasses("mono")}>
                      {item.cvss_v3_score ?? "-"}
                    </td>
                    <td>
                      <span className={resolveClasses("cell-stack")}>
                        <strong>{item.repository_name ?? "-"}</strong>
                        <small
                          className={resolveClasses("mono")}
                          title={item.digest}
                        >
                          {shortDigest(item.digest ?? "")}
                        </small>
                      </span>
                    </td>
                    <td>
                      <span className={resolveClasses(styles.tagStack)}>
                        {item.tags?.slice(0, 3).map((tag) => (
                          <span key={tag} className={resolveClasses("badge")}>
                            {tag}
                          </span>
                        )) ?? "-"}
                      </span>
                    </td>
                    <td>{item.package ?? "-"}</td>
                    <td className={resolveClasses("mono")}>
                      {item.version ?? "-"}
                    </td>
                    <td className={resolveClasses("mono")}>
                      {item.fixed_version ?? t("暂无")}
                    </td>
                    <td>
                      <VulnerabilityStatus value={item.status} />
                    </td>
                    <td>
                      {target ? (
                        <a
                          className={resolveClasses("icon-button")}
                          href={target}
                          title={t("打开制品")}
                          aria-label={t("打开制品")}
                        >
                          <Icon name="chevron" />
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="没有匹配的漏洞"
            description="更换筛选条件，或确认制品已经完成漏洞扫描。"
            icon="shield"
          />
        )}
      </div>
      <Pagination
        pagination={collection.pagination}
        onPageChange={(page) => {
          navigate(
            securityPath("vulnerabilities", {
              ...values,
              page,
              page_size: collection.pagination.page_size,
            }),
          );
        }}
        pageSizeOptions={[20, 50, 100]}
        onPageSizeChange={(pageSize) => {
          navigate(
            securityPath("vulnerabilities", {
              ...values,
              page: 1,
              page_size: pageSize,
            }),
          );
        }}
      />
    </section>
  );
}

type ScannersSectionProps = {
  route: ConsoleRoute;
  collection: ControlList<ScannerRegistration>;
  navigate: (path: string) => void;
  onAction: (action: SecurityAction) => void;
  onNotice: (message: string, error?: boolean) => void;
  onReload: () => void;
};

function ScannersSection({
  route,
  collection,
  navigate,
  onAction,
  onNotice,
  onReload,
}: ScannersSectionProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const filter = route.query.get("filter") ?? "";
  const [query, setQuery] = useResettableState(filter);
  async function ping(scanner: ScannerRegistration) {
    try {
      await mutate({
        operation: "scanner-ping",
        parameters: {},
        method: "POST",
        payload: {
          name: scanner.name,
          url: scanner.url,
          auth: scanner.auth ?? "",
          access_credential: "",
          skip_certVerify: Boolean(scanner.skip_certVerify),
          use_internal_addr: Boolean(scanner.use_internal_addr),
        },
      });
      onNotice("扫描器连接正常");
    } catch (error) {
      onNotice(errorText(error), true);
    }
  }
  async function makeDefault(scanner: ScannerRegistration) {
    try {
      await mutate({
        operation: "scanner",
        parameters: { id: scanner.uuid },
        method: "PATCH",
        payload: {
          is_default: true,
        },
      });
      onNotice("默认扫描器已更新");
      onReload();
    } catch (error) {
      onNotice(errorText(error), true);
    }
  }
  return (
    <section className={resolveClasses("table-shell")}>
      <div className={resolveClasses("table-toolbar")}>
        <ToolbarSearchForm
          name="filter"
          placeholder="按扫描器名称搜索"
          value={query}
          onChange={setQuery}
          onSubmit={(term) => {
            navigate(
              securityPath("scanners", {
                filter: term,
                page: 1,
                page_size: collection.pagination.page_size,
              }),
            );
          }}
        />
        <div className={resolveClasses("toolbar-spacer")} />
        <button
          className={resolveClasses("button button-small button-primary")}
          type="button"
          onClick={() => {
            onAction({
              kind: "create-scanner",
              canDisable: collection.pagination.total > 0,
            });
          }}
        >
          <Icon name="plus" />
          <span>{t("注册扫描器")}</span>
        </button>
      </div>
      <div className={resolveClasses("table-scroll")}>
        {collection.items.length ? (
          <table>
            <thead>
              <tr>
                <th>{t("扫描器")}</th>
                <th>{t("地址")}</th>
                <th>{t("健康状态")}</th>
                <th>{t("能力")}</th>
                <th className={resolveClasses("table-cell-time")}>
                  {t("最近更新")}
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {collection.items.map((scanner) => (
                <tr key={scanner.uuid}>
                  <td>
                    <div className={resolveClasses("cell-title")}>
                      <span className={resolveClasses("cell-icon")}>
                        <Icon name="shield" />
                      </span>
                      <span className={resolveClasses("cell-stack")}>
                        <strong>{scanner.name ?? "-"}</strong>
                        <small>
                          {(() => {
                            if (
                              [scanner.vendor, scanner.version].filter(
                                (value): value is string => Boolean(value),
                              ).length
                            ) {
                              return [scanner.vendor, scanner.version]
                                .filter((value): value is string =>
                                  Boolean(value),
                                )
                                .join(" · ");
                            }
                            if (scanner.description?.trim()) {
                              return scanner.description;
                            }
                            return scanner.uuid;
                          })()}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td className={resolveClasses("truncate-cell mono")}>
                    {scanner.url ?? "-"}
                  </td>
                  <td>
                    {scanner.disabled ? (
                      <span className={resolveClasses("badge")}>
                        {t("已停用")}
                      </span>
                    ) : (
                      <StatusBadge status={scanner.health} />
                    )}
                  </td>
                  <td>
                    {scanner.is_default ? (
                      <span className={resolveClasses("badge badge-orange")}>
                        {t("默认")}
                      </span>
                    ) : (
                      <span className={resolveClasses("badge badge-blue")}>
                        {t("已注册")}
                      </span>
                    )}
                  </td>
                  <td className={resolveClasses("table-cell-time")}>
                    {formatDate(scanner.update_time ?? scanner.create_time, {
                      locale: locale,
                      timeZone: displayTimeZone(),
                    })}
                  </td>
                  <td>
                    <div className={resolveClasses("row-actions")}>
                      <button
                        className={resolveClasses("icon-button")}
                        type="button"
                        title={t("查看扫描器元数据")}
                        aria-label={t("查看扫描器元数据")}
                        onClick={() => {
                          onAction({ kind: "scanner-metadata", scanner });
                        }}
                      >
                        <Icon name="info" />
                      </button>
                      <button
                        className={resolveClasses("icon-button")}
                        type="button"
                        title={t("测试连接")}
                        aria-label={t("测试连接")}
                        onClick={() => void ping(scanner)}
                      >
                        <Icon name="refresh" />
                      </button>
                      {scanner.is_default ? null : (
                        <button
                          className={resolveClasses("icon-button")}
                          type="button"
                          title={t("设为默认")}
                          aria-label={t("设为默认")}
                          onClick={() => void makeDefault(scanner)}
                        >
                          <Icon name="check" />
                        </button>
                      )}
                      <button
                        className={resolveClasses("icon-button")}
                        type="button"
                        title={t("编辑扫描器")}
                        aria-label={t("编辑扫描器")}
                        onClick={() => {
                          onAction({ kind: "edit-scanner", scanner });
                        }}
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        className={resolveClasses("icon-button danger-icon")}
                        type="button"
                        title={t("删除扫描器")}
                        aria-label={t("删除扫描器")}
                        onClick={() => {
                          onAction({ kind: "delete-scanner", scanner });
                        }}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="暂无扫描器"
            description="注册兼容 Harbor Scanner Adapter API 的扫描器。"
            icon="shield"
          />
        )}
      </div>
      <Pagination
        pagination={collection.pagination}
        onPageChange={(page) => {
          navigate(
            securityPath("scanners", {
              filter,
              page,
              page_size: collection.pagination.page_size,
            }),
          );
        }}
        pageSizeOptions={[20, 50, 100]}
        onPageSizeChange={(pageSize) => {
          navigate(
            securityPath("scanners", {
              filter,
              page: 1,
              page_size: pageSize,
            }),
          );
        }}
      />
    </section>
  );
}

type ExportsSectionProps = {
  executions: CveExportExecution[];
  projects: ProjectSummary[];
  onAction: (action: SecurityAction) => void;
  onNotice: (message: string) => void;
};

function ExportsSection({
  executions,
  projects,
  onAction,
  onNotice,
}: ExportsSectionProps) {
  const { locale, t } = useLocale();
  function downloadExecution(id: number | string) {
    const anchor = document.createElement("a");
    anchor.href = `/api/operations/cve-export-download?id=${encodeURIComponent(String(id))}&format=CSV`;
    anchor.download = "";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    onNotice(`${t("正在下载导出任务")} #${String(id)}`);
  }

  return (
    <>
      <section className={resolveClasses(styles.securityExportIntro)}>
        <div>
          <span className={resolveClasses("eyebrow")}>
            {t("官方扫描数据导出")}
          </span>
          <h2>{t("生成可离线分析的 CVE 清单")}</h2>
          <p>
            {t(
              "导出任务由 Harbor JobService 执行，完成后可直接下载 CSV 文件。",
            )}
          </p>
        </div>
        <button
          className={resolveClasses("button button-small button-primary")}
          type="button"
          disabled={!projects.length}
          onClick={() => {
            onAction({ kind: "create-export", projects });
          }}
        >
          <Icon name="plus" />
          <span>{t("新建导出")}</span>
        </button>
      </section>
      <section className={resolveClasses("table-shell")}>
        <div className={resolveClasses("table-toolbar")}>
          <PanelTitle
            title="导出执行记录"
            count={formatCount({
              total: executions.length,
              locale: locale,
              chineseUnit: "次执行",
              englishUnit: "executions",
            })}
          />
        </div>
        <div className={resolveClasses("table-scroll")}>
          {executions.length ? (
            <table>
              <thead>
                <tr>
                  <th>{t("执行")}</th>
                  <th>{t("发起人")}</th>
                  <th>{t("触发方式")}</th>
                  <th>{t("状态")}</th>
                  <th className={resolveClasses("table-cell-time")}>
                    {t("开始时间")}
                  </th>
                  <th className={resolveClasses("table-cell-time")}>
                    {t("结束时间")}
                  </th>
                  <th className={resolveClasses("table-cell-time")}>
                    {t("耗时")}
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {executions.map((execution) => {
                  const status = execution.status?.toLowerCase() ?? "";
                  const success = ["success", "succeed", "completed"].includes(
                    status,
                  );
                  const failed = ["error", "failed"].includes(status);
                  return (
                    <tr key={execution.id}>
                      <td className={resolveClasses("id-cell")}>
                        #{execution.id}
                      </td>
                      <td>
                        {execution.user_name ??
                          `${t("用户")} #${String(execution.user_id ?? "-")}`}
                      </td>
                      <td>{triggerLabel(execution.trigger, t)}</td>
                      <td>
                        <StatusBadge status={execution.status} />
                      </td>
                      <td className={resolveClasses("table-cell-time")}>
                        {formatDate(execution.start_time, {
                          locale: locale,
                          timeZone: displayTimeZone(),
                        })}
                      </td>
                      <td className={resolveClasses("table-cell-time")}>
                        {formatDate(execution.end_time, {
                          locale: locale,
                          timeZone: displayTimeZone(),
                        })}
                      </td>
                      <td className={resolveClasses("table-cell-time")}>
                        {formatDuration(
                          execution.start_time,
                          execution.end_time,
                          locale,
                        )}
                      </td>
                      <td>
                        <div className={resolveClasses("row-actions")}>
                          {failed ? (
                            <button
                              className={resolveClasses("icon-button")}
                              type="button"
                              title={t("查看失败详情")}
                              aria-label={t("查看失败详情")}
                              onClick={() => {
                                onAction({ kind: "export-detail", execution });
                              }}
                            >
                              <Icon name="alert" />
                            </button>
                          ) : null}
                          {success && execution.file_present !== false ? (
                            <button
                              className={resolveClasses("button button-small")}
                              type="button"
                              onClick={() => {
                                downloadExecution(execution.id);
                              }}
                            >
                              <Icon name="database" />
                              <span>{t("下载 CSV")}</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState
              title="暂无导出记录"
              description="创建导出任务后，执行状态和下载入口会显示在这里。"
              icon="database"
            />
          )}
        </div>
      </section>
    </>
  );
}

type AllowlistSectionProps = {
  allowlist: CveAllowlist;
  onAction: (action: SecurityAction) => void;
};

function AllowlistSection({ allowlist, onAction }: AllowlistSectionProps) {
  const { locale, t } = useLocale();
  const items = allowlist.items ?? [];
  const permanent = !allowlist.expires_at;
  const expiration = permanent
    ? t("永久生效")
    : formatDate(new Date((allowlist.expires_at ?? 0) * 1000).toISOString(), {
        locale,
        includeTime: false,
        timeZone: displayTimeZone(),
      });
  return (
    <>
      <section className={resolveClasses(styles.allowlistSummary)}>
        <div className={resolveClasses(styles.allowlistSummaryHead)}>
          <div>
            <span className={resolveClasses("eyebrow")}>
              {t("系统级 CVE Allowlist")}
            </span>
            <h2>
              {locale === "en-US"
                ? `${formatNumber(items.length, locale)} exception vulnerabilities`
                : `${formatNumber(items.length, locale)} 个例外漏洞`}
            </h2>
            <p>
              {expiration} · {t("最近更新")}{" "}
              {formatDate(allowlist.update_time, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            </p>
          </div>
          <button
            className={resolveClasses("button button-small button-primary")}
            type="button"
            onClick={() => {
              onAction({ kind: "edit-allowlist", allowlist });
            }}
          >
            <Icon name="edit" />
            <span>{t("编辑白名单")}</span>
          </button>
        </div>
        <div className={resolveClasses(styles.allowlistItems)}>
          {items.length ? (
            items.map((item) => (
              <span
                key={item.cve_id}
                className={resolveClasses(styles.allowlistChip)}
              >
                <Icon name="check" />
                <code>{item.cve_id}</code>
              </span>
            ))
          ) : (
            <div className={resolveClasses(styles.allowlistEmpty)}>
              <Icon name="shield" />
              <span>{t("系统白名单为空，所有漏洞均按扫描结果处理。")}</span>
            </div>
          )}
        </div>
      </section>
      <section className={resolveClasses(styles.securityGuidance)}>
        <div>
          <Icon name="alert" />
        </div>
        <div>
          <h2>{t("白名单只忽略指定 CVE")}</h2>
          <p>
            {t(
              "项目可以继承此系统白名单，也可以在项目设置中使用独立白名单。到期后 Harbor 会自动恢复这些 CVE 的风险判定。",
            )}
          </p>
        </div>
      </section>
    </>
  );
}

type SecurityPageProps = {
  route: ConsoleRoute;
  projects: ProjectSummary[];
  totalArtifacts: number;
  demo: boolean;
  refreshing: boolean;
  navigate: (path: string) => void;
  onRefresh: () => void;
  onAction: (action: SecurityAction) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function SecurityPage({
  route,
  projects,
  totalArtifacts,
  demo,
  refreshing,
  navigate,
  onRefresh,
  onAction,
  onNotice,
}: SecurityPageProps) {
  const { t } = useLocale();
  const section = sectionFromRoute(route);
  const parsedPage = Number(route.query.get("page"));
  const parsedPageSize = Number(route.query.get("page_size"));
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = [20, 50, 100].includes(parsedPageSize) ? parsedPageSize : 50;
  const scannerFilter = route.query.get("filter") ?? "";
  const vulnerabilityParameters =
    section === "vulnerabilities" ? vulnerabilityQuery(route, projects) : "";

  const sectionQuery = useSecurityData({
    section,
    page,
    pageSize,
    scannerFilter,
    vulnerabilityParameters,
  });
  const data = sectionQuery.data;
  const error = sectionQuery.error;
  const reload = sectionQuery.reload;

  return (
    <>
      <PageHeader
        title="安全中心"
        subtitle={t("集中管理扫描器、漏洞风险、扫描数据导出与 CVE 白名单")}
        actions={
          <>
            <RefreshButton
              refreshing={refreshing || !data}
              onRefresh={() => {
                reload();
                onRefresh();
              }}
            />
            {section === "vulnerabilities" ? (
              <a
                className={resolveClasses("button button-small button-primary")}
                href="#/security/exports"
              >
                <Icon name="database" />
                <span>{t("导出扫描数据")}</span>
              </a>
            ) : null}
          </>
        }
      />
      {demo ? <DemoBanner /> : null}
      <SecurityTabs selected={section} />
      <ContentTransition mode={section}>
        {error ? (
          <ErrorView title="安全模块载入失败" message={error} retry={reload} />
        ) : null}
        {!data && !error ? (
          <section className={resolveClasses("table-shell")}>
            <div className={resolveClasses("loading-state")}>
              <div>
                <span className={resolveClasses("spinner")} />
              </div>
            </div>
          </section>
        ) : null}
        {data?.section === "overview" ? (
          <SecurityOverview
            summary={data.summary}
            totalArtifacts={totalArtifacts}
            projects={projects}
          />
        ) : null}
        {data?.section === "scanners" ? (
          <ScannersSection
            route={route}
            collection={data.scanners}
            navigate={navigate}
            onAction={onAction}
            onNotice={onNotice}
            onReload={reload}
          />
        ) : null}
        {data?.section === "vulnerabilities" ? (
          <VulnerabilitiesSection
            route={route}
            collection={data.vulnerabilities}
            projects={projects}
            navigate={navigate}
          />
        ) : null}
        {data?.section === "exports" ? (
          <ExportsSection
            executions={data.executions}
            projects={projects}
            onAction={onAction}
            onNotice={onNotice}
          />
        ) : null}
        {data?.section === "allowlist" ? (
          <AllowlistSection allowlist={data.allowlist} onAction={onAction} />
        ) : null}
      </ContentTransition>
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
  "panel-title": uiStyles0.panelTitle,
  "refresh-button": uiStyles0.refreshButton,
  "stat-cell": uiStyles0.statCell,
  "status-badge": uiStyles0.statusBadge,
  "unified-select": uiStyles0.unifiedSelect,
  tag: uiStyles0.tag,
  "resource-tabs": uiStyles0.resourceTabs,
  active: uiStyles0.active,
  "overview-stats": uiStyles0.overviewStats,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-caption": uiStyles0.toolbarCaption,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "table-scroll": uiStyles0.tableScroll,
  mono: uiStyles0.mono,
  "cell-stack": uiStyles0.cellStack,
  "vulnerability-description": uiStyles0.vulnerabilityDescription,
  "icon-button": uiStyles0.iconButton,
  "danger-text": uiStyles0.dangerText,
  "badge-green": uiStyles0.badgeGreen,
  "badge-orange": uiStyles0.badgeOrange,
  badge: uiStyles0.badge,
  "toolbar-search": uiStyles0.toolbarSearch,
  "toolbar-field": uiStyles0.toolbarField,
  "toolbar-select": uiStyles0.toolbarSelect,
  "button-primary": uiStyles0.buttonPrimary,
  "table-cell-time": uiStyles0.tableCellTime,
  "cell-title": uiStyles0.cellTitle,
  "cell-icon": uiStyles0.cellIcon,
  "truncate-cell": uiStyles0.truncateCell,
  "badge-blue": uiStyles0.badgeBlue,
  "row-actions": uiStyles0.rowActions,
  "danger-icon": uiStyles0.dangerIcon,
  eyebrow: uiStyles0.eyebrow,
  "id-cell": uiStyles0.idCell,
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

function useSecurityData({
  section,
  page,
  pageSize,
  scannerFilter,
  vulnerabilityParameters,
}: {
  section: SecuritySection;
  page: number;
  pageSize: number;
  scannerFilter: string;
  vulnerabilityParameters: string;
}) {
  return useLoadedQuery(
    securityKeys.section(section, {
      page,
      pageSize,
      scannerFilter,
      vulnerabilityParameters,
    }),
    async (signal): Promise<SectionData> => {
      if (section === "overview")
        return {
          section,
          summary:
            (await controlApi.data<SecuritySummary>(
              "security-summary",
              { with_dangerous_cve: true, with_dangerous_artifact: true },
              signal,
            )) ?? {},
        };
      if (section === "scanners")
        return {
          section,
          scanners: await controlApi.list<ScannerRegistration>(
            "scanners",
            {
              page,
              page_size: pageSize,
              sort: "name",
              q: scannerFilter ? `name=~${scannerFilter}` : "",
            },
            signal,
          ),
        };
      if (section === "vulnerabilities")
        return {
          section,
          vulnerabilities: await controlApi.list<SecurityVulnerability>(
            "security-vulnerabilities",
            {
              page,
              page_size: pageSize,
              q: vulnerabilityParameters,
              tune_count: true,
              with_tag: true,
            },
            signal,
          ),
        };
      if (section === "allowlist")
        return {
          section,
          allowlist:
            (await controlApi.data<CveAllowlist>(
              "system-cve-allowlist",
              {},
              signal,
            )) ?? {},
        };
      const raw = await controlApi.data<
        CveExportExecution[] | { items?: CveExportExecution[] }
      >("cve-export-executions", {}, signal);
      return {
        section,
        executions: Array.isArray(raw) ? raw : (raw?.items ?? []),
      };
    },
    { keepPrevious: false },
  );
}
