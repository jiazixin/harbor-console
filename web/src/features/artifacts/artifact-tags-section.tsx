import { useLocale } from "../../app/locale-context";
import type {
  ArtifactTag,
  ControlList,
  HarborArtifact,
} from "../../app/models";
import { displayTimeZone, loadPreferences } from "../../app/preferences";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { OverflowText } from "../../components/overflow-text";
import { Pagination } from "../../components/pagination";
import { PanelTitle } from "../../components/panel-title";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, instanceHost } from "../../lib/format/formatters";
import { artifactPullCommand } from "./artifact-utils";

type ArtifactTagsSectionProps = {
  artifact: HarborArtifact;
  project: string;
  repository: string;
  instanceUrl: string;
  collection: ControlList<ArtifactTag>;
  onAdd: () => void;
  onCopy: (value: string) => void;
  onDelete: (tag: ArtifactTag) => void;
  onPageChange: (page: number) => void;
};

export function ArtifactTagsSection({
  artifact,
  project,
  repository,
  instanceUrl,
  collection,
  onAdd,
  onCopy,
  onDelete,
  onPageChange,
}: ArtifactTagsSectionProps) {
  const { locale, t } = useLocale();
  const runtime = loadPreferences().runtime;
  return (
    <section className={resolveClasses("table-shell")}>
      <div className={resolveClasses("table-toolbar")}>
        <PanelTitle title="Tag 列表" />
        <div className={resolveClasses("toolbar-spacer")} />
        <button
          className={resolveClasses("button button-small button-primary")}
          type="button"
          onClick={onAdd}
        >
          <Icon name="plus" />
          <span>{t("添加 Tag")}</span>
        </button>
      </div>
      <div className={resolveClasses("table-scroll")}>
        {collection.items.length ? (
          <table>
            <thead>
              <tr>
                <th>Tag</th>
                <th>{t("不可变")}</th>
                <th className={resolveClasses("table-cell-time")}>
                  {t("推送时间")}
                </th>
                <th className={resolveClasses("table-cell-time")}>
                  {t("最近拉取")}
                </th>
                <th className={resolveClasses("table-cell-center")}>
                  {t("拉取命令")}
                </th>
                <th className={resolveClasses("table-cell-center")} />
              </tr>
            </thead>
            <tbody>
              {collection.items.map((tag) => {
                const command = artifactPullCommand({
                  instanceHost: instanceHost(instanceUrl),
                  project,
                  repository,
                  artifact,
                  tag: tag.name,
                  runtime,
                });
                return (
                  <tr key={tag.id ?? tag.name}>
                    <td>
                      <div className={resolveClasses("cell-title")}>
                        <OverflowText as="strong">{tag.name}</OverflowText>
                      </div>
                    </td>
                    <td>
                      {tag.immutable ? (
                        <span className={resolveClasses("badge badge-orange")}>
                          {t("不可变")}
                        </span>
                      ) : (
                        <span className={resolveClasses("badge")}>
                          {t("可变")}
                        </span>
                      )}
                    </td>
                    <td className={resolveClasses("table-cell-time")}>
                      {formatDate(tag.push_time, {
                        locale: locale,
                        timeZone: displayTimeZone(),
                      })}
                    </td>
                    <td className={resolveClasses("table-cell-time")}>
                      {formatDate(tag.pull_time, {
                        locale: locale,
                        timeZone: displayTimeZone(),
                      })}
                    </td>
                    <td className={resolveClasses("table-cell-center")}>
                      <button
                        className={resolveClasses("button button-small")}
                        type="button"
                        onClick={() => {
                          onCopy(command);
                        }}
                      >
                        <Icon name="copy" />
                        <span>{t("复制")}</span>
                      </button>
                    </td>
                    <td className={resolveClasses("table-cell-center")}>
                      <button
                        className={resolveClasses("icon-button danger-icon")}
                        type="button"
                        disabled={tag.immutable}
                        title={t("删除 Tag")}
                        aria-label={t("删除 Tag")}
                        onClick={() => {
                          onDelete(tag);
                        }}
                      >
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="没有 Tag"
            description="该制品当前只能通过摘要引用。"
            icon="tag"
          />
        )}
      </div>
      <Pagination
        pagination={collection.pagination}
        onPageChange={onPageChange}
      />
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
  "table-scroll": uiStyles0.tableScroll,
  "table-cell-time": uiStyles0.tableCellTime,
  "table-cell-center": uiStyles0.tableCellCenter,
  "cell-title": uiStyles0.cellTitle,
  badge: uiStyles0.badge,
  "badge-orange": uiStyles0.badgeOrange,
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
