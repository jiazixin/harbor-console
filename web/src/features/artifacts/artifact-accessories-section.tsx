import { useLocale } from "../../app/locale-context";
import type { ArtifactAccessory, ControlList } from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { Pagination } from "../../components/pagination";
import { PanelTitle } from "../../components/panel-title";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import {
  formatBytes,
  formatDate,
  formatNumber,
} from "../../lib/format/formatters";
import { shortDigest } from "./artifact-utils";

import { artifactAccessoryTypeLabel } from "./artifact-detail-sections-support";

type ArtifactAccessoriesSectionProps = {
  collection: ControlList<ArtifactAccessory>;
  loadError?: string;
  onOpen: (item: ArtifactAccessory) => void;
  onCopy: (value: string) => void;
  onDelete: (item: ArtifactAccessory) => void;
  onPageChange: (page: number) => void;
};

export function ArtifactAccessoriesSection({
  collection,
  loadError,
  onOpen,
  onCopy,
  onDelete,
  onPageChange,
}: ArtifactAccessoriesSectionProps) {
  const { locale, t } = useLocale();
  if (loadError)
    return (
      <section className={resolveClasses("panel")}>
        <EmptyState
          title="关联制品不可用"
          description={loadError}
          icon="alert"
        />
      </section>
    );
  if (!collection.items.length)
    return (
      <section className={resolveClasses("panel")}>
        <EmptyState
          title="没有关联制品"
          description="签名、SBOM 和其他 OCI Referrer 会显示在这里。"
          icon="database"
        />
      </section>
    );
  return (
    <section className={resolveClasses("table-shell")}>
      <div className={resolveClasses("table-toolbar")}>
        <PanelTitle title="OCI 关联制品" />
        <div className={resolveClasses("toolbar-spacer")} />
        <span className={resolveClasses("muted")}>
          {formatNumber(
            collection.pagination.total || collection.items.length,
            locale,
          )}{" "}
          {t("项")}
        </span>
      </div>
      <div className={resolveClasses("table-scroll")}>
        <table>
          <thead>
            <tr>
              <th>{t("类型")}</th>
              <th>{t("摘要")}</th>
              <th>{t("大小")}</th>
              <th className={resolveClasses("table-cell-time")}>
                {t("创建时间")}
              </th>
              <th className={resolveClasses("table-cell-center")} />
            </tr>
          </thead>
          <tbody>
            {collection.items.map((item) => (
              <tr key={item.id ?? item.digest}>
                <td>
                  <div className={resolveClasses("cell-title")}>
                    <span className={resolveClasses("cell-stack")}>
                      <strong>
                        {t(artifactAccessoryTypeLabel(item.type))}
                      </strong>
                      <small>{item.type ?? "OCI Referrer"}</small>
                    </span>
                  </div>
                </td>
                <td>
                  <code title={item.digest}>{shortDigest(item.digest)}</code>
                </td>
                <td>{formatBytes(item.size, locale)}</td>
                <td className={resolveClasses("table-cell-time")}>
                  {formatDate(item.creation_time, {
                    locale: locale,
                    timeZone: displayTimeZone(),
                  })}
                </td>
                <td className={resolveClasses("table-cell-center")}>
                  <div className={resolveClasses("row-actions")}>
                    <button
                      className={resolveClasses("icon-button")}
                      type="button"
                      title={t("打开关联制品")}
                      aria-label={t("打开关联制品")}
                      onClick={() => {
                        onOpen(item);
                      }}
                    >
                      <Icon name="external" />
                    </button>
                    <button
                      className={resolveClasses("icon-button")}
                      type="button"
                      title={t("复制摘要")}
                      aria-label={t("复制摘要")}
                      onClick={() => {
                        onCopy(item.digest);
                      }}
                    >
                      <Icon name="copy" />
                    </button>
                    <button
                      className={resolveClasses("icon-button danger-icon")}
                      type="button"
                      title={t("删除关联制品")}
                      aria-label={t("删除关联制品")}
                      onClick={() => {
                        onDelete(item);
                      }}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  "panel-title": uiStyles0.panelTitle,
  panel: uiStyles0.panel,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  muted: uiStyles0.muted,
  "table-scroll": uiStyles0.tableScroll,
  "table-cell-time": uiStyles0.tableCellTime,
  "table-cell-center": uiStyles0.tableCellCenter,
  "cell-title": uiStyles0.cellTitle,
  "cell-stack": uiStyles0.cellStack,
  "row-actions": uiStyles0.rowActions,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
  "danger-icon": uiStyles0.dangerIcon,
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
