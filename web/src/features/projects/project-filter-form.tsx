import { type SubmitEvent } from "react";
import { useLocale } from "../../app/locale-context";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { useResettableState } from "../../lib/state/use-resettable-state";
import uiStyles1 from "./project-filter-form.module.css";
import {
  type ProjectRouteState,
  type ProjectVisibility,
} from "./project-list-data";

type ProjectFilters = Pick<ProjectRouteState, "owner" | "query" | "visibility">;

type ProjectFilterFormProps = {
  filters: ProjectFilters;
  onApply: (filters: ProjectFilters) => void;
};

export function ProjectFilterForm({
  filters,
  onApply,
}: ProjectFilterFormProps) {
  const { t } = useLocale();
  const [name, setName] = useResettableState(filters.query);
  const [owner, setOwner] = useResettableState(filters.owner);
  const [visibility, setVisibility] = useResettableState<ProjectVisibility>(
    filters.visibility,
  );
  const hasActiveFilters = Boolean(
    filters.query || filters.visibility || filters.owner,
  );

  return (
    <form
      className={resolveClasses("table-toolbar project-filter-toolbar")}
      onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        onApply({ query: name.trim(), owner: owner.trim(), visibility });
      }}
    >
      <div className={resolveClasses("toolbar-search")}>
        <Icon name="search" />
        <FormInput
          name="name"
          type="search"
          maxLength={255}
          value={name}
          placeholder={t("按项目名称搜索")}
          aria-label={t("按项目名称搜索")}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
      </div>
      <div className={resolveClasses("toolbar-search project-owner-search")}>
        <Icon name="users" />
        <FormInput
          name="owner"
          type="search"
          maxLength={255}
          value={owner}
          placeholder={t("项目所有者")}
          aria-label={t("按项目所有者筛选")}
          onChange={(event) => {
            setOwner(event.currentTarget.value);
          }}
        />
      </div>
      <label className={resolveClasses("toolbar-field")}>
        <span>{t("可见性")}</span>
        <UnifiedSelect
          name="visibility"
          className={resolveClasses("toolbar-select")}
          value={visibility}
          ariaLabel={t("可见性")}
          options={[
            { value: "", label: t("全部项目") },
            { value: "public", label: t("公开") },
            { value: "private", label: t("私有") },
          ]}
          onChange={setVisibility}
        />
      </label>
      <button
        className={resolveClasses("button button-small button-primary")}
        type="submit"
      >
        <Icon name="search" />
        <span>{t("筛选")}</span>
      </button>
      {hasActiveFilters ? (
        <button
          className={resolveClasses("button button-small")}
          type="button"
          onClick={() => {
            onApply({ query: "", owner: "", visibility: "" });
          }}
        >
          {t("取消筛选")}
        </button>
      ) : null}
    </form>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "unified-select": uiStyles0.unifiedSelect,
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
  "project-filter-toolbar": uiStyles1.projectFilterToolbar,
  "project-owner-search": uiStyles1.projectOwnerSearch,
});
