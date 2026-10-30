import { type SubmitEvent } from "react";
import { useLocale } from "../../app/locale-context";
import type { ProjectLabel } from "../../app/models";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { useResettableState } from "../../lib/state/use-resettable-state";
import {
  artifactTypes,
  type RepositoryRouteState,
} from "./repository-artifacts-data";

import styles from "./artifacts.module.css";

type ArtifactFilters = Pick<
  RepositoryRouteState,
  "artifactType" | "labelId" | "query" | "scanStatus" | "tagState"
>;

const emptyArtifactFilters: ArtifactFilters = {
  query: "",
  artifactType: "",
  tagState: "",
  labelId: "",
  scanStatus: "",
};

function hasFilters(filters: ArtifactFilters): boolean {
  return Boolean(
    filters.query ||
    filters.artifactType ||
    filters.tagState ||
    filters.labelId ||
    filters.scanStatus,
  );
}

type ArtifactFilterFormProps = {
  filters: ArtifactFilters;
  labels: ProjectLabel[];
  onApply: (filters: ArtifactFilters) => void;
};

export function ArtifactFilterForm({
  filters,
  labels,
  onApply,
}: ArtifactFilterFormProps) {
  const { t } = useLocale();
  const [query, setQuery] = useResettableState(filters.query);
  const [artifactType, setArtifactType] = useResettableState(
    filters.artifactType,
  );
  const [tagState, setTagState] = useResettableState(filters.tagState);
  const [labelId, setLabelId] = useResettableState(filters.labelId);
  const [scanStatus, setScanStatus] = useResettableState(filters.scanStatus);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    onApply({
      query: trimmedQuery,
      artifactType,
      // Harbor matches a Tag search only against tagged artifacts.
      tagState: trimmedQuery ? "" : tagState,
      labelId,
      scanStatus,
    });
  }

  return (
    <form
      className={resolveClasses(
        `table-toolbar ${styles.artifactFilterToolbar}`,
      )}
      onSubmit={submit}
    >
      <label className={resolveClasses("toolbar-search")}>
        <Icon name="search" />
        <FormInput
          name="q"
          type="search"
          value={query}
          placeholder={t("按 Tag 搜索制品")}
          aria-label={t("按 Tag 搜索制品")}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
        />
      </label>
      <label className={resolveClasses("toolbar-field")}>
        <span>{t("类型")}</span>
        <UnifiedSelect
          ariaLabel={t("类型")}
          className={resolveClasses("toolbar-select")}
          value={artifactType}
          options={[
            { value: "", label: t("全部") },
            ...artifactTypes.map((value) => ({ value, label: value })),
          ]}
          onChange={setArtifactType}
        />
      </label>
      <label className={resolveClasses("toolbar-field")}>
        <span>Tag</span>
        <UnifiedSelect
          ariaLabel="Tag"
          className={resolveClasses("toolbar-select")}
          disabled={Boolean(query)}
          value={tagState}
          options={[
            { value: "", label: t("全部") },
            { value: "tagged", label: t("有 Tag") },
            { value: "untagged", label: t("无 Tag") },
          ]}
          onChange={setTagState}
        />
      </label>
      <label className={resolveClasses("toolbar-field")}>
        <span>{t("标签")}</span>
        <UnifiedSelect
          ariaLabel={t("标签")}
          className={resolveClasses("toolbar-select")}
          value={labelId}
          options={[
            { value: "", label: t("全部") },
            ...labels.map((label) => ({
              value: String(label.id),
              label: t(label.name),
            })),
          ]}
          onChange={setLabelId}
        />
      </label>
      <label className={resolveClasses("toolbar-field")}>
        <span>{t("扫描")}</span>
        <UnifiedSelect
          ariaLabel={t("扫描")}
          className={resolveClasses("toolbar-select")}
          value={scanStatus}
          options={[
            { value: "", label: t("全部") },
            { value: "success", label: t("成功") },
            { value: "running", label: t("运行中") },
            { value: "error", label: t("失败") },
            { value: "stopped", label: t("已停止") },
            { value: "unscanned", label: t("未扫描") },
          ]}
          onChange={setScanStatus}
        />
      </label>
      <div className={resolveClasses("filter-toolbar-actions")}>
        <button
          className={resolveClasses("button button-small button-primary")}
          type="submit"
        >
          <Icon name="search" />
          <span>{t("筛选")}</span>
        </button>
        {hasFilters(filters) ? (
          <button
            className={resolveClasses("button button-small")}
            type="button"
            onClick={() => {
              onApply(emptyArtifactFilters);
            }}
          >
            <Icon name="x" />
            <span>{t("清除")}</span>
          </button>
        ) : null}
      </div>
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
  "filter-toolbar-actions": uiStyles0.filterToolbarActions,
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
