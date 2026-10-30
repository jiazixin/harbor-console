import { type SubmitEvent } from "react";
import { useLocale } from "../../app/locale-context";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

type ReplicationPolicyFilterProps = {
  query: string;
  onSearch: (query: string) => void;
};

export function ReplicationPolicyFilter({
  query,
  onSearch,
}: ReplicationPolicyFilterProps) {
  const { t } = useLocale();
  return (
    <form
      className={resolveClasses("table-toolbar")}
      onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("q");
        onSearch(typeof value === "string" ? value.trim() : "");
      }}
    >
      <div className={resolveClasses("toolbar-search")}>
        <Icon name="search" />
        <FormInput
          name="q"
          type="search"
          maxLength={255}
          defaultValue={query}
          placeholder={t("按策略名称搜索")}
          aria-label={t("按策略名称搜索")}
        />
      </div>
      <button
        className={resolveClasses("button button-small button-primary")}
        type="submit"
      >
        <Icon name="search" />
        <span>{t("筛选")}</span>
      </button>
      {query ? (
        <button
          className={resolveClasses("button button-small")}
          type="button"
          onClick={() => {
            onSearch("");
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
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-search": uiStyles0.toolbarSearch,
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
});
