import { useLocale } from "../../app/locale-context";
import type { ProjectSummary } from "../../app/models";
import uiStyles0 from "../../components/shared-ui.module.css";
import { StatCell } from "../../components/stat-cell";
import { createClassNames } from "../../lib/css/class-names";
import { formatNumber } from "../../lib/format/formatters";
import { metadataEnabled, projectNumber } from "./project-list-data";

type ProjectOverviewStatsProps = {
  projects?: ProjectSummary[];
  error: string;
};

export function ProjectOverviewStats({
  projects,
  error,
}: ProjectOverviewStatsProps) {
  const { locale, t } = useLocale();
  const loading = projects === undefined && !error;
  const total = projects?.length ?? 0;
  const enabledCount = (field: "auto_scan" | "prevent_vul") =>
    projects?.filter((project) => metadataEnabled(project, field)).length ?? 0;
  const coverage = (enabled: number) =>
    total ? `${String(Math.round((enabled / total) * 100))}%` : "0%";
  const footnote = (ready: string) =>
    (() => {
      if (loading) {
        return t("正在载入");
      }
      if (error) {
        return t("统计不可用");
      }
      return ready;
    })();
  const enabledFootnote = (count: number) =>
    footnote(`${t("已启用")} ${formatNumber(count, locale)} ${t("个")}`);
  const autoScan = enabledCount("auto_scan");
  const blocking = enabledCount("prevent_vul");
  const repositoryCount =
    projects?.reduce(
      (sum, project) => sum + projectNumber(project.repo_count),
      0,
    ) ?? 0;
  return (
    <section
      className={resolveClasses("overview-stats project-overview-stats")}
      aria-label={t("项目中心概览")}
      aria-busy={loading}
    >
      <StatCell
        label={t("项目总数")}
        value={projects ? formatNumber(total, locale) : "-"}
        foot={footnote(t("当前账号可见项目"))}
        icon="folder"
      />
      <StatCell
        label={t("仓库数量")}
        value={projects ? formatNumber(repositoryCount, locale) : "-"}
        foot={footnote(t("当前筛选结果"))}
        icon="package"
      />
      <StatCell
        label={t("自动扫描覆盖")}
        value={projects ? coverage(autoScan) : "-"}
        foot={enabledFootnote(autoScan)}
        icon="scan"
      />
      <StatCell
        label={t("漏洞阻止覆盖")}
        value={projects ? coverage(blocking) : "-"}
        foot={enabledFootnote(blocking)}
        icon="bug"
      />
    </section>
  );
}

const resolveClasses = createClassNames({
  "stat-cell": uiStyles0.statCell,
  "overview-stats": uiStyles0.overviewStats,
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
