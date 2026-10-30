import { useLocale } from "../../app/locale-context";
import type {
  ArtifactVulnerability,
  ArtifactVulnerabilityReport,
} from "../../app/models";
import { EmptyState } from "../../components/empty-state";
import { PanelTitle } from "../../components/panel-title";
import { SeverityBadge } from "../../components/severity-badge";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatCount } from "../../lib/format/formatters";

import {
  isRecord,
  recordArray,
  stringValue,
} from "./artifact-detail-sections-support";

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

type ArtifactVulnerabilitiesSectionProps = {
  report?: ArtifactVulnerabilityReport;
  loadError?: string;
  notScanned?: boolean;
};

export function ArtifactVulnerabilitiesSection({
  report,
  loadError,
  notScanned = false,
}: ArtifactVulnerabilitiesSectionProps) {
  const { locale, t } = useLocale();
  if (notScanned)
    return (
      <section className={resolveClasses("panel")}>
        <EmptyState
          title="尚未扫描"
          description="该制品还没有漏洞报告。可通过页面顶部的“扫描 / SBOM”发起扫描。"
          icon="shield"
        />
      </section>
    );
  if (loadError)
    return (
      <section className={resolveClasses("panel")}>
        <EmptyState
          title="漏洞报告不可用"
          description={loadError}
          icon="alert"
        />
      </section>
    );
  const normalized = normalizeVulnerabilityReport(report);
  if (!normalized.items.length)
    return (
      <section className={resolveClasses("panel")}>
        <EmptyState
          title="没有漏洞记录"
          description="扫描报告未包含漏洞。"
          icon="shield"
        />
      </section>
    );
  return (
    <section className={resolveClasses("table-shell")}>
      <div className={resolveClasses("table-toolbar")}>
        <PanelTitle
          title="漏洞明细"
          count={`${formatCount({ total: normalized.items.length, locale: locale, chineseUnit: "条", englishUnit: "entries" })} · ${t(normalized.scanner)}`}
        />
      </div>
      <div className={resolveClasses("table-scroll")}>
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
                  <strong className={resolveClasses("mono")}>
                    {item.id ?? item.cve_id ?? "-"}
                  </strong>
                </td>
                <td>
                  <SeverityBadge severity={item.severity} />
                </td>
                <td>{item.package ?? item.package_name ?? "-"}</td>
                <td className={resolveClasses("mono")}>
                  {item.version ?? item.package_version ?? "-"}
                </td>
                <td className={resolveClasses("mono")}>
                  {item.fix_version ?? item.fixed_version ?? t("暂无")}
                </td>
                <td className={resolveClasses("vulnerability-description")}>
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

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  "panel-title": uiStyles0.panelTitle,
  panel: uiStyles0.panel,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "table-scroll": uiStyles0.tableScroll,
  mono: uiStyles0.mono,
  "vulnerability-description": uiStyles0.vulnerabilityDescription,
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
