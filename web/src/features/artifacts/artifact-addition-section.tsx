import { useLocale } from "../../app/locale-context";
import { displayTimeZone } from "../../app/preferences";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, formatNumber } from "../../lib/format/formatters";

import {
  arrayValue,
  artifactAdditionTabs,
  artifactAdditionText,
  type ArtifactDetailTab,
  isRecord,
  normalizedAddition,
  recordArray,
  stringValue,
} from "./artifact-detail-sections-support";
import styles from "./artifacts.module.css";

function numberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

type AdditionContentProps = {
  tab: ArtifactDetailTab;
  addition: unknown;
};

function AdditionContent({ tab, addition }: AdditionContentProps) {
  const { locale, t } = useLocale();
  const record = isRecord(addition) ? addition : {};
  if (tab === "sbom") {
    const packages = recordArray(record.packages);
    if (packages.length)
      return (
        <>
          <div className={resolveClasses(styles.additionSummary)}>
            <span className={resolveClasses("badge badge-blue")}>
              {stringValue(record.spdxVersion, "SBOM")}
            </span>
            <strong>
              {formatNumber(packages.length, locale)} {t("个软件包")}
            </strong>
          </div>
          <div className={resolveClasses("table-scroll")}>
            <table>
              <thead>
                <tr>
                  <th>{t("软件包")}</th>
                  <th>{t("版本")}</th>
                  <th>{t("许可证")}</th>
                  <th>{t("供应商")}</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((item, index) => (
                  <tr key={`${stringValue(item.name)}-${String(index)}`}>
                    <td>
                      <strong>
                        {stringValue(item.name ?? item.package_name, "-")}
                      </strong>
                    </td>
                    <td className={resolveClasses("mono")}>
                      {stringValue(item.versionInfo ?? item.version, "-")}
                    </td>
                    <td>
                      {stringValue(
                        item.licenseConcluded ?? item.license,
                        t("未知"),
                      )}
                    </td>
                    <td>{stringValue(item.supplier ?? item.vendor, "-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
  }
  if (tab === "license") {
    const licenses = recordArray(record.licenses ?? addition);
    if (licenses.length)
      return (
        <div className={resolveClasses("table-scroll")}>
          <table>
            <thead>
              <tr>
                <th>{t("许可证")}</th>
                <th>{t("标识")}</th>
                <th>{t("命中组件")}</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((item, index) => (
                <tr key={`${stringValue(item.id)}-${String(index)}`}>
                  <td>
                    <strong>
                      {stringValue(
                        item.name ?? item.license ?? item.id,
                        t("未知"),
                      )}
                    </strong>
                  </td>
                  <td className={resolveClasses("mono")}>
                    {stringValue(item.id ?? item.spdx_id, "-")}
                  </td>
                  <td>
                    {formatNumber(
                      numberValue(item.count ?? item.package_count),
                      locale,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
  if (tab === "files") {
    const files = arrayValue(record.files ?? addition);
    if (files.length)
      return (
        <div className={resolveClasses(styles.artifactFileList)}>
          {files.map((item, index) => (
            <code key={String(index)}>
              {(() => {
                if (typeof item === "string") {
                  return item;
                }
                if (isRecord(item)) {
                  return stringValue(
                    item.path ?? item.name,
                    JSON.stringify(item),
                  );
                }
                return JSON.stringify(item);
              })()}
            </code>
          ))}
        </div>
      );
  }
  if (tab === "build") {
    const history = recordArray(record.history ?? addition);
    if (history.length)
      return (
        <div className={resolveClasses("table-scroll")}>
          <table>
            <thead>
              <tr>
                <th className={resolveClasses("table-cell-time")}>
                  {t("创建时间")}
                </th>
                <th>{t("构建指令")}</th>
                <th>{t("文件层")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, index) => (
                <tr key={String(index)}>
                  <td className={resolveClasses("table-cell-time")}>
                    {formatDate(stringValue(item.created), {
                      locale: locale,
                      timeZone: displayTimeZone(),
                    })}
                  </td>
                  <td>
                    <code className={resolveClasses(styles.additionCommand)}>
                      {stringValue(item.created_by ?? item.command, "-")}
                    </code>
                  </td>
                  <td>
                    {item.empty_layer === true ? (
                      <span className={resolveClasses("badge")}>
                        {t("仅元数据")}
                      </span>
                    ) : (
                      <span className={resolveClasses("badge badge-blue")}>
                        {t("包含文件")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
  if (tab === "dependencies") {
    const dependencies = recordArray(record.dependencies ?? addition);
    if (dependencies.length)
      return (
        <div className={resolveClasses("table-scroll")}>
          <table>
            <thead>
              <tr>
                <th>{t("依赖")}</th>
                <th>{t("版本")}</th>
                <th>{t("来源")}</th>
              </tr>
            </thead>
            <tbody>
              {dependencies.map((item, index) => (
                <tr key={`${stringValue(item.name)}-${String(index)}`}>
                  <td>
                    <strong>
                      {stringValue(item.name ?? item.package, "-")}
                    </strong>
                  </td>
                  <td className={resolveClasses("mono")}>
                    {stringValue(item.version, "-")}
                  </td>
                  <td className={resolveClasses("truncate-cell")}>
                    {stringValue(item.repository ?? item.source, "-")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
  return (
    <pre className={resolveClasses(styles.artifactAdditionCode)}>
      <code>{artifactAdditionText(addition)}</code>
    </pre>
  );
}

type ArtifactAdditionSectionProps = {
  tab: keyof typeof artifactAdditionTabs;
  value?: unknown;
  loadError?: string;
  onCopy: () => void;
  onDownload: () => void;
};

export function ArtifactAdditionSection({
  tab,
  value,
  loadError,
  onCopy,
  onDownload,
}: ArtifactAdditionSectionProps) {
  const { locale, t } = useLocale();
  const meta = artifactAdditionTabs[tab];
  if (loadError)
    return (
      <section className={resolveClasses("panel")}>
        <EmptyState
          title={
            locale === "en-US"
              ? `${t(meta.label)} unavailable`
              : `${meta.label} 不可用`
          }
          description={loadError}
          icon="alert"
        />
      </section>
    );
  const addition = normalizedAddition(value);
  if (
    addition === undefined ||
    addition === null ||
    addition === "" ||
    (Array.isArray(addition) && !addition.length)
  )
    return (
      <section className={resolveClasses("panel")}>
        <EmptyState
          title={
            locale === "en-US"
              ? `No ${t(meta.label).toLowerCase()}`
              : `没有${meta.label}`
          }
          description="当前制品未提供这项附加信息。"
          icon={meta.icon}
        />
      </section>
    );
  return (
    <section
      className={resolveClasses(`table-shell ${styles.artifactAdditionPanel}`)}
    >
      <div className={resolveClasses("table-toolbar")}>
        <div>
          <strong>{t(meta.label)}</strong>
          <span className={resolveClasses("toolbar-caption")}>
            {t("Harbor 官方制品附加信息")}
          </span>
        </div>
        <div className={resolveClasses("toolbar-spacer")} />
        <button
          className={resolveClasses("button button-small")}
          type="button"
          onClick={onCopy}
        >
          <Icon name="copy" />
          <span>{t("复制")}</span>
        </button>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          onClick={onDownload}
        >
          <Icon name="database" />
          <span>{t("下载")}</span>
        </button>
      </div>
      <AdditionContent tab={tab} addition={addition} />
    </section>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  badge: uiStyles0.badge,
  "badge-blue": uiStyles0.badgeBlue,
  "table-scroll": uiStyles0.tableScroll,
  mono: uiStyles0.mono,
  "table-cell-time": uiStyles0.tableCellTime,
  "truncate-cell": uiStyles0.truncateCell,
  panel: uiStyles0.panel,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-caption": uiStyles0.toolbarCaption,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
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
