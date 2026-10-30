import { useLocale } from "../../app/locale-context";
import { displayTimeZone } from "../../app/preferences";
import uiStyles0 from "../../components/shared-ui.module.css";
import { StatCell } from "../../components/stat-cell";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, formatNumber } from "../../lib/format/formatters";
import { type RepositoryAsset } from "./repository-asset-data";
import { repositoryTimestamp } from "./repository-sorting";
import uiStyles1 from "./shared-ui.module.css";

function numberValue(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

type RepositoryAssetStatsProps = {
  /** Undefined until the first load finishes. */
  repositories?: RepositoryAsset[];
  projectCount: number;
  loading: boolean;
  unavailable: boolean;
};

export function RepositoryAssetStats({
  repositories,
  projectCount,
  loading,
  unavailable,
}: RepositoryAssetStatsProps) {
  const { locale, t } = useLocale();
  const items = repositories ?? [];
  const sum = (field: "artifact_count" | "pull_count") =>
    items.reduce(
      (total, repository) => total + numberValue(repository[field]),
      0,
    );
  const latestUpdate = items.reduce<string | undefined>(
    (latest, repository) =>
      repositoryTimestamp(repository.update_time) > repositoryTimestamp(latest)
        ? repository.update_time
        : latest,
    undefined,
  );
  const value = (ready: () => string) => (repositories ? ready() : "-");
  const footnote = (ready: string) =>
    (() => {
      if (loading) {
        return t("正在载入");
      }
      if (unavailable) {
        return t("统计不可用");
      }
      return ready;
    })();
  return (
    <section
      className={resolveClasses("overview-stats repository-asset-stats")}
      aria-label={t("镜像仓库统计")}
      aria-busy={loading}
    >
      <StatCell
        label={t("镜像仓库")}
        value={value(() => formatNumber(items.length, locale))}
        foot={footnote(`${formatNumber(projectCount, locale)} ${t("个项目")}`)}
        icon="package"
      />
      <StatCell
        label={t("制品总数")}
        value={value(() => formatNumber(sum("artifact_count"), locale))}
        foot={footnote(t("跨项目统计"))}
        icon="database"
      />
      <StatCell
        label={t("累计拉取")}
        value={value(() => formatNumber(sum("pull_count"), locale))}
        foot={footnote(t("Harbor 记录值"))}
        icon="history"
      />
      <StatCell
        label={t("最近更新")}
        value={value(() =>
          formatDate(latestUpdate, {
            locale: locale,
            timeZone: displayTimeZone(),
            includeTime: false,
          }),
        )}
        foot={footnote(t("Harbor 仓库更新时间"))}
        icon="upload"
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
  "repository-asset-stats": uiStyles1.repositoryAssetStats,
});
