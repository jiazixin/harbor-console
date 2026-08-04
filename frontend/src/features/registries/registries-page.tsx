import { useCallback, useEffect, useRef, useState } from "react";

import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type { Registry, RegistryAdapterInfo } from "../../app/models";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
} from "../../components/page-elements";
import { StatusBadge } from "../../components/status-badge";
import { Icon } from "../../components/icons";

export type RegistryAction =
  | {
      kind: "create";
      adapters: string[];
      adapterInfos: Partial<Record<string, RegistryAdapterInfo>>;
    }
  | {
      kind: "edit";
      registry: Registry;
      adapters: string[];
      adapterInfos: Partial<Record<string, RegistryAdapterInfo>>;
    }
  | { kind: "delete"; registry: Registry };

function registryTypeLabel(value: string | undefined): string {
  return (
    {
      harbor: "Harbor",
      "docker-hub": "Docker Hub",
      "docker-registry": "Docker Registry",
      "aws-ecr": "AWS ECR",
      "azure-acr": "Azure ACR",
      "google-gcr": "Google GCR",
      "ali-acr": "阿里云 ACR",
      "huawei-SWR": "华为云 SWR",
      "tencent-tcr": "腾讯云 TCR",
      "volcengine-cr": "火山引擎 CR",
      "github-ghcr": "GitHub GHCR",
      gitlab: "GitLab",
      quay: "Quay",
      "jfrog-artifactory": "JFrog Artifactory",
    }[value ?? ""] ??
    value ??
    "通用仓库"
  );
}

async function loadAllRegistries(signal: AbortSignal): Promise<Registry[]> {
  const items: Registry[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await controlApi.list<Registry>(
      "registries",
      { page, page_size: 100, sort: "name" },
      signal,
    );
    items.push(...result.items);
    if (items.length >= result.pagination.total || result.items.length < 100)
      break;
  }
  return items.sort((left, right) =>
    (left.name ?? "").localeCompare(right.name ?? ""),
  );
}

function RegistryEmpty() {
  const { t } = useLocale();
  return (
    <div className="empty-table">
      <Icon name="database" />
      <div>
        <strong>{t("暂无远端仓库")}</strong>
        <span>{t("添加连接后可用于复制和代理缓存。")}</span>
      </div>
    </div>
  );
}

export function RegistriesPage({
  demo,
  refreshing,
  onRefresh,
  onAction,
  onNotice,
}: {
  demo: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAction: (action: RegistryAction) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const [registries, setRegistries] = useState<Registry[]>();
  const [adapters, setAdapters] = useState<string[]>([]);
  const [adapterInfos, setAdapterInfos] = useState<
    Partial<Record<string, RegistryAdapterInfo>>
  >({});
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const requestVersion = useRef(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const current = requestVersion.current + 1;
    requestVersion.current = current;
    setRegistries(undefined);
    setError("");
    void Promise.all([
      loadAllRegistries(controller.signal),
      controlApi
        .data<string[]>("registry-adapters", {}, controller.signal)
        .catch(() => []),
      controlApi
        .data<Record<string, RegistryAdapterInfo>>(
          "registry-adapter-infos",
          {},
          controller.signal,
        )
        .catch(() => ({})),
    ])
      .then(([registryItems, adapterItems, info]) => {
        if (requestVersion.current !== current) return;
        setRegistries(registryItems);
        setAdapters(adapterItems ?? []);
        setAdapterInfos(info ?? {});
      })
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        if (requestVersion.current === current)
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
      });
    return () => controller.abort();
  }, [version]);

  function editAction(registry: Registry): RegistryAction {
    return { kind: "edit", registry, adapters, adapterInfos };
  }

  return (
    <>
      <PageHeader
        title="远端仓库"
        subtitle={t("管理 Harbor 连接的远端镜像仓库")}
        actions={
          <>
            <RefreshButton
              refreshing={refreshing || !registries}
              onRefresh={() => {
                reload();
                onRefresh();
              }}
            />
            <button
              className="button button-small button-primary"
              type="button"
              onClick={() =>
                onAction({ kind: "create", adapters, adapterInfos })
              }
            >
              <Icon name="plus" />
              <span>{t("新建连接")}</span>
            </button>
          </>
        }
      />
      {demo ? <DemoBanner /> : null}
      {error ? (
        <section className="security-module-state" role="alert">
          <span className="state-icon">
            <Icon name="alert" />
          </span>
          <div>
            <h2>{t("远端仓库载入失败")}</h2>
            <p>{error}</p>
          </div>
          <button
            className="button button-small"
            type="button"
            onClick={reload}
          >
            <Icon name="refresh" />
            <span>{t("重新尝试")}</span>
          </button>
        </section>
      ) : null}
      {!registries && !error ? (
        <section className="table-shell">
          <div className="loading-state">
            <div>
              <span className="spinner" />
            </div>
          </div>
        </section>
      ) : null}
      {registries && !registries.length ? (
        <section className="panel">
          <RegistryEmpty />
        </section>
      ) : null}
      {registries?.length ? (
        <section className="registry-grid control-registry-grid">
          {registries.map((registry) => (
            <article key={registry.id} className="registry-item">
              <div className="registry-top">
                <span className="registry-icon">
                  <Icon name="database" />
                </span>
                <StatusBadge status={registry.status ?? "unknown"} />
              </div>
              <h3>{registry.name ?? t("未命名仓库")}</h3>
              <span className="registry-url" title={registry.url}>
                {registry.url ?? t("未配置地址")}
              </span>
              <div className="registry-meta">
                <span>{t(registryTypeLabel(registry.type))}</span>
                <span>#{registry.id ?? "-"}</span>
              </div>
              <div className="registry-actions">
                <button
                  className="button button-small"
                  type="button"
                  onClick={() =>
                    void controlApi
                      .mutate("registry-ping", {}, "POST", {
                        id: registry.id,
                      })
                      .then(() => onNotice("远端仓库连接正常"))
                      .catch((pingError: unknown) =>
                        onNotice(
                          pingError instanceof Error
                            ? pingError.message
                            : String(pingError),
                          true,
                        ),
                      )
                  }
                >
                  <Icon name="refresh" />
                  <span>{t("测试连接")}</span>
                </button>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    type="button"
                    title={t("编辑")}
                    aria-label={t("编辑")}
                    onClick={() => onAction(editAction(registry))}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    className="icon-button danger-icon"
                    type="button"
                    title={t("删除")}
                    aria-label={t("删除")}
                    onClick={() => onAction({ kind: "delete", registry })}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}
