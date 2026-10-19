import { useCallback, useEffect, useRef, useState } from "react";

import { request } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type { AboutPayload, Session } from "../../app/models";
import { DefinitionList } from "../../components/definition-list";
import { ErrorView } from "../../components/feedback";
import { Icon } from "../../components/icons";
import { PageHeader, RefreshButton } from "../../components/page-elements";

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

export function AboutPage({
  session,
  harborVersion,
  refreshing,
  onRefresh,
}: {
  session: Session;
  harborVersion?: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useLocale();
  const [payload, setPayload] = useState<AboutPayload>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const requestVersion = useRef(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const current = requestVersion.current + 1;
    requestVersion.current = current;
    setPayload(undefined);
    setError("");
    void request<AboutPayload>("/api/about", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted && requestVersion.current === current)
          setPayload(data);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted || requestVersion.current !== current)
          return;
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      });
    return () => controller.abort();
  }, [version]);

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
        <section className="table-shell">
          <div
            className="route-loading"
            role="status"
            aria-label={t("正在载入")}
          >
            <span className="spinner spinner-small" />
          </div>
        </section>
      ) : null}
      {error ? (
        <ErrorView title="产品信息载入失败" message={error} retry={reload} />
      ) : null}
      {payload ? (
        <div className="about-layout">
          <section className="about-product-band">
            <div className="about-product-mark">H</div>
            <div>
              <span className="eyebrow">{t("Harbor 控制台")}</span>
              <h2>{t("私有镜像仓库控制端")}</h2>
              <p>
                {t(
                  "Go 单二进制部署，前端资源全部内嵌，使用 Harbor API v2.0 驱动控制功能。",
                )}
              </p>
            </div>
            <span className="badge badge-green">{t("纯内网可用")}</span>
          </section>
          <div className="about-grid">
            <section className="panel">
              <div className="panel-head">
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
                    value: consoleInfo.build_date ?? t("未知"),
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
            <section className="panel">
              <div className="panel-head">
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
          <section className="about-contract">
            <div>
              <h2>{t("Harbor 官方 Swagger")}</h2>
              <p>
                {t("在新标签页中查看当前 Harbor 实例提供的完整 API 文档。")}
              </p>
              {swaggerURL ? (
                <code className="about-swagger-url">{swaggerURL}</code>
              ) : (
                <span className="about-swagger-unavailable">
                  {t(
                    "当前为演示实例，连接真实 Harbor 后可打开其官方 Swagger。",
                  )}
                </span>
              )}
            </div>
            {swaggerURL ? (
              <a
                className="button button-small button-primary"
                href={swaggerURL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="external" />
                <span>{t("打开官方 Swagger")}</span>
              </a>
            ) : (
              <button className="button button-small" type="button" disabled>
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
