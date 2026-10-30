import { type SubmitEvent } from "react";
import { useLocale } from "../../app/locale-context";
import type { ProjectSummary } from "../../app/models";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { ViewModeToggle } from "../../components/view-mode-toggle";
import { createClassNames } from "../../lib/css/class-names";
import { useResettableState } from "../../lib/state/use-resettable-state";
import uiStyles2 from "./repository-asset-toolbar.module.css";
import uiStyles1 from "./shared-ui.module.css";

type ViewMode = "card" | "list";

type RepositoryAssetToolbarProps = {
  query: string;
  project: string;
  projects: ProjectSummary[];
  viewMode: ViewMode;
  onSearch: (query: string) => void;
  onProjectChange: (project: string) => void;
  onClear: () => void;
  onViewModeChange: (mode: ViewMode) => void;
};

export function RepositoryAssetToolbar({
  query,
  project,
  projects,
  viewMode,
  onSearch,
  onProjectChange,
  onClear,
  onViewModeChange,
}: RepositoryAssetToolbarProps) {
  const { t } = useLocale();
  const [draftQuery, setDraftQuery] = useResettableState(query);
  const projectOptions = [
    { value: "", label: t("全部项目") },
    ...projects.map(({ name }) => ({ value: name, label: name })),
  ];

  return (
    <form
      className={resolveClasses("table-toolbar repository-asset-toolbar")}
      onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSearch(draftQuery.trim());
      }}
    >
      <div className={resolveClasses("repository-asset-toolbar-primary")}>
        <div className={resolveClasses("toolbar-search")}>
          <Icon name="search" />
          <FormInput
            name="q"
            type="search"
            maxLength={255}
            value={draftQuery}
            placeholder={t("搜索项目或仓库")}
            aria-label={t("搜索项目或仓库")}
            onChange={(event) => {
              setDraftQuery(event.currentTarget.value);
            }}
          />
        </div>
        <label className={resolveClasses("toolbar-field")}>
          <span>{t("项目")}</span>
          <UnifiedSelect
            ariaLabel={t("项目")}
            className={resolveClasses("toolbar-select")}
            value={project}
            options={projectOptions}
            onChange={onProjectChange}
          />
        </label>
        <button
          className={resolveClasses("button button-small button-primary")}
          type="submit"
        >
          <Icon name="search" />
          <span>{t("筛选")}</span>
        </button>
        {query || project ? (
          <button
            className={resolveClasses("button button-small")}
            type="button"
            onClick={onClear}
          >
            {t("取消筛选")}
          </button>
        ) : null}
      </div>
      <div className={resolveClasses("repository-asset-toolbar-actions")}>
        <ViewModeToggle
          value={viewMode}
          ariaLabel={t("仓库展示方式")}
          listLabel={t("列表视图")}
          cardLabel={t("卡片视图")}
          onChange={onViewModeChange}
        />
      </div>
    </form>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "unified-select": uiStyles0.unifiedSelect,
  "view-mode-toggle": uiStyles0.viewModeToggle,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-search": uiStyles0.toolbarSearch,
  "toolbar-field": uiStyles0.toolbarField,
  "toolbar-select": uiStyles0.toolbarSelect,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
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
  "repository-asset-toolbar": uiStyles1.repositoryAssetToolbar,
  "repository-asset-toolbar-primary": uiStyles2.repositoryAssetToolbarPrimary,
  "repository-asset-toolbar-actions": uiStyles2.repositoryAssetToolbarActions,
});
