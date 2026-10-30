import { displayTimeZone } from "../../app/preferences";
import { formatDate } from "../../lib/format/formatters";
import { api } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type { AboutPayload, Session } from "../../app/models";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { DefinitionList } from "../../components/definition-list";
import { ErrorView } from "../../components/error-view";
import { Icon } from "../../components/icon";
import { PageHeader } from "../../components/page-header";
import { RefreshButton } from "../../components/refresh-button";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { aboutKeys } from "./about-keys";
import styles from "./about.module.css";

export function harborSwaggerURL(session: Session): string {
  if (session.demo) return "";
  try {
    const url = new URL(session.instance_url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.pathname =
      `${url.pathname.replace(/\/+$/, "")}/devcenter-api-2.0/`.replace(
        /\/{2,}/g,
        "/",
      );
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

type AboutPageProps = {
  session: Session;
  harborVersion?: string;
  refreshing: boolean;
  onRefresh: () => void;
};

export function AboutPage({
  session,
  harborVersion,
  refreshing,
  onRefresh,
}: AboutPageProps) {
  const { locale, t } = useLocale();
  const about = useAboutData();
  const payload = about.data;
  const error = about.error;
  const reload = about.reload;

  const swaggerURL = harborSwaggerURL(session);
  const consoleInfo = payload?.console ?? {};
  const harbor = payload?.harbor ?? {};
  const license = harbor.license ?? {};

  return (
    <>
      <PageHeader
        title="关于与 API"
        subtitle={t("版本、许可证与当前实例的 Harbor 官方 Swagger")}
        actions={
          <RefreshButton
            refreshing={refreshing || (!payload && !error)}
            onRefresh={() => {
              reload();
              onRefresh();
            }}
          />
        }
      />
      {!payload && !error ? (
        <section className={resolveClasses("table-shell")}>
          <div
            className={resolveClasses("route-loading")}
            role="status"
            aria-label={t("正在载入")}
          >
            <span className={resolveClasses("spinner spinner-small")} />
          </div>
        </section>
      ) : null}
      {error ? (
        <ErrorView title="产品信息载入失败" message={error} retry={reload} />
      ) : null}
      {payload ? (
        <div className={resolveClasses(styles.aboutLayout)}>
          <section className={resolveClasses(styles.aboutProductBand)}>
            <div className={resolveClasses(styles.aboutProductMark)}>H</div>
            <div>
              <span className={resolveClasses("eyebrow")}>
                {t("Harbor 控制台")}
              </span>
              <h2>{t("私有镜像仓库控制端")}</h2>
              <p>
                {t(
                  "Go 单二进制部署，前端资源全部内嵌，使用 Harbor API v2.0 驱动控制功能。",
                )}
              </p>
            </div>
            <span className={resolveClasses("badge badge-green")}>
              {t("纯内网可用")}
            </span>
          </section>
          <div className={resolveClasses(styles.aboutGrid)}>
            <section className={resolveClasses("panel")}>
              <div className={resolveClasses("panel-head")}>
                <div>
                  <h2>{t("版本信息")}</h2>
                  <p>{t("当前控制端与 Harbor 实例")}</p>
                </div>
              </div>
              <DefinitionList
                rows={[
                  {
                    label: t("控制端版本"),
                    value: consoleInfo.version ?? t("开发版"),
                  },
                  {
                    label: t("构建提交"),
                    value: consoleInfo.commit ?? t("未知"),
                  },
                  {
                    label: t("构建时间"),
                    value: formatDate(consoleInfo.build_date, {
                      locale,
                      timeZone: displayTimeZone(),
                    }),
                  },
                  {
                    label: t("当前 Harbor"),
                    value: harborVersion ?? t("未知"),
                  },
                  {
                    label: t("目标 Harbor 版本"),
                    value: harbor.target_version ?? "v2.15.x",
                  },
                  { label: t("API 版本"), value: harbor.api_version ?? "v2.0" },
                ]}
              />
            </section>
            <section className={resolveClasses("panel")}>
              <div className={resolveClasses("panel-head")}>
                <div>
                  <h2>{t("许可证")}</h2>
                  <p>{t("Harbor 上游项目信息")}</p>
                </div>
              </div>
              <DefinitionList
                rows={[
                  {
                    label: t("许可证名称"),
                    value: license.name ?? "Apache License 2.0",
                  },
                  {
                    label: t("SPDX 标识"),
                    value: license.spdx ?? "Apache-2.0",
                  },
                  {
                    label: t("运行方式"),
                    value: t(
                      consoleInfo.deployment === "single-binary"
                        ? "Go 单二进制"
                        : (consoleInfo.deployment ?? "未知"),
                    ),
                  },
                  {
                    label: t("外部前端依赖"),
                    value: t(consoleInfo.offline ? "无" : "未知"),
                  },
                ]}
              />
            </section>
          </div>
          <section className={resolveClasses(styles.aboutContract)}>
            <div>
              <h2>{t("Harbor 官方 Swagger")}</h2>
              <p>
                {t("在新标签页中查看当前 Harbor 实例提供的完整 API 文档。")}
              </p>
              {swaggerURL ? (
                <code className={resolveClasses(styles.aboutSwaggerUrl)}>
                  {swaggerURL}
                </code>
              ) : (
                <span
                  className={resolveClasses(styles.aboutSwaggerUnavailable)}
                >
                  {t(
                    "当前为演示实例，连接真实 Harbor 后可打开其官方 Swagger。",
                  )}
                </span>
              )}
            </div>
            {swaggerURL ? (
              <a
                className={resolveClasses("button button-small button-primary")}
                href={swaggerURL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="external" />
                <span>{t("打开官方 Swagger")}</span>
              </a>
            ) : (
              <button
                className={resolveClasses("button button-small")}
                type="button"
                disabled
              >
                <Icon name="external" />
                <span>{t("打开官方 Swagger")}</span>
              </button>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

const resolveClasses = createClassNames({
  "definition-list": uiStyles0.definitionList,
  icon: uiStyles0.icon,
  "page-header": uiStyles0.pageHeader,
  "refresh-button": uiStyles0.refreshButton,
  "table-shell": uiStyles0.tableShell,
  "route-loading": uiStyles0.routeLoading,
  spinner: uiStyles0.spinner,
  "spinner-small": uiStyles0.spinnerSmall,
  eyebrow: uiStyles0.eyebrow,
  badge: uiStyles0.badge,
  "badge-green": uiStyles0.badgeGreen,
  panel: uiStyles0.panel,
  "panel-head": uiStyles0.panelHead,
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

function useAboutData() {
  return useLoadedQuery(
    aboutKeys.all,
    (signal) => api<AboutPayload>("/api/info", { signal }),
    { keepPrevious: false },
  );
}
