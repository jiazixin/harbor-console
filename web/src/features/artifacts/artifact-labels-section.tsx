import { useLocale } from "../../app/locale-context";
import type { ArtifactLabelCollection, ProjectLabel } from "../../app/models";
import { ColorSwatch } from "../../components/color-swatch";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { OverflowText } from "../../components/overflow-text";
import { PanelTitle } from "../../components/panel-title";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatCount } from "../../lib/format/formatters";

import styles from "./artifacts.module.css";

type ArtifactLabelsSectionProps = {
  collection: ArtifactLabelCollection;
  onAttach: () => void;
  onRemove: (label: ProjectLabel) => void;
};

export function ArtifactLabelsSection({
  collection,
  onAttach,
  onRemove,
}: ArtifactLabelsSectionProps) {
  const { locale, t } = useLocale();
  return (
    <section className={resolveClasses("table-shell artifact-label-panel")}>
      <div className={resolveClasses("table-toolbar")}>
        <PanelTitle
          title="制品标签"
          count={formatCount({
            total: collection.attached.length,
            locale: locale,
            chineseUnit: "个已绑定",
            englishUnit: "attached",
          })}
        />
        <div className={resolveClasses("toolbar-spacer")} />
        <button
          className={resolveClasses("button button-small button-primary")}
          type="button"
          disabled={collection.available.length <= collection.attached.length}
          onClick={onAttach}
        >
          <Icon name="plus" />
          <span>{t("绑定标签")}</span>
        </button>
      </div>
      {collection.load_error ? (
        <div
          className={resolveClasses(
            `notice notice-warning ${styles.artifactInlineWarning}`,
          )}
        >
          <Icon name="alert" />
          <span>
            {t("部分标签载入失败")}：{collection.load_error}
          </span>
        </div>
      ) : null}
      {collection.attached.length ? (
        <div className={resolveClasses(styles.artifactLabelList)}>
          {collection.attached.map((label) => (
            <div
              className={resolveClasses(styles.artifactLabelRow)}
              key={label.id}
            >
              <ColorSwatch
                className={resolveClasses("label-swatch")}
                color={label.color}
              />
              <span className={resolveClasses("cell-stack")}>
                <OverflowText as="strong">{t(label.name)}</OverflowText>
                <OverflowText as="small">
                  {`${t(label.scope === "g" ? "全局标签" : "项目标签")}${label.description ? ` · ${t(label.description)}` : ""}`}
                </OverflowText>
              </span>
              <button
                className={resolveClasses("icon-button danger-icon")}
                type="button"
                title={t("移除标签")}
                aria-label={t("移除标签")}
                onClick={() => {
                  onRemove(label);
                }}
              >
                <Icon name="x" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="尚未绑定标签"
          description="绑定项目或全局标签后，可快速识别和筛选制品。"
          icon="tag"
        />
      )}
    </section>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "overflow-text": uiStyles0.overflowText,
  "panel-title": uiStyles0.panelTitle,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  "label-swatch": uiStyles0.labelSwatch,
  "cell-stack": uiStyles0.cellStack,
  "icon-button": uiStyles0.iconButton,
  "danger-icon": uiStyles0.dangerIcon,
  tag: uiStyles0.tag,
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
