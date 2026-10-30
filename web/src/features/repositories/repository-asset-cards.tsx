import { useLocale } from "../../app/locale-context";
import { displayTimeZone } from "../../app/preferences";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, formatNumber } from "../../lib/format/formatters";
import uiStyles1 from "./repository-asset-cards.module.css";
import {
  nameWithinProject,
  projectRepositoriesHref,
  type RepositoryAsset,
  repositoryAssetKey,
} from "./repository-asset-data";

type RepositoryAssetCardsProps = {
  repositories: RepositoryAsset[];
  onOpen: (repository: RepositoryAsset) => void;
  onShowPushCommand: (repository: RepositoryAsset) => void;
};

export function RepositoryAssetCards({
  repositories,
  onOpen,
  onShowPushCommand,
}: RepositoryAssetCardsProps) {
  const { locale, t } = useLocale();
  return (
    <div
      className={resolveClasses(
        "repository-card-grid repository-asset-card-grid",
      )}
    >
      {repositories.map((repository) => (
        <article
          key={repositoryAssetKey(repository)}
          className={resolveClasses("repository-card")}
        >
          <header>
            <div>
              <button
                type="button"
                onClick={() => {
                  onOpen(repository);
                }}
              >
                {nameWithinProject(repository)}
              </button>
              <a href={projectRepositoriesHref(repository.project_name)}>
                {repository.project_name}
              </a>
            </div>
            <button
              className={resolveClasses("icon-button")}
              type="button"
              title={t("推送指引")}
              aria-label={t("查看推送指引")}
              onClick={() => {
                onShowPushCommand(repository);
              }}
            >
              <Icon name="upload" />
            </button>
          </header>
          <p>
            {repository.description?.trim()
              ? repository.description
              : t("暂无仓库描述")}
          </p>
          <dl>
            <div>
              <dt>{t("制品")}</dt>
              <dd>{formatNumber(repository.artifact_count, locale)}</dd>
            </div>
            <div>
              <dt>{t("累计拉取")}</dt>
              <dd>{formatNumber(repository.pull_count, locale)}</dd>
            </div>
            <div>
              <dt>{t("最近更新")}</dt>
              <dd>
                {formatDate(repository.update_time, {
                  locale: locale,
                  timeZone: displayTimeZone(),
                })}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "repository-card-grid": uiStyles0.repositoryCardGrid,
  "repository-card": uiStyles0.repositoryCard,
  button: uiStyles0.button,
  "icon-button": uiStyles0.iconButton,
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
  "repository-asset-card-grid": uiStyles1.repositoryAssetCardGrid,
});
