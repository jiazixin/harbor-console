import {
  type FormEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ApiError, publicCatalogApi } from "../../app/api-client";
import { formatBytes, formatDate, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  HarborArtifact,
  ProjectSummary,
  PublicCatalogLevel,
  PublicCatalogRequest,
  PublicCatalogState,
  RepositorySummary,
} from "../../app/models";
import { loadPreferences } from "../../app/preferences";
import { Pagination } from "../../components/data-table";
import { HarborBrand } from "../../components/harbor-brand";
import { Icon } from "../../components/icons";
import { LanguageSwitch } from "../../components/language-switch";
import { SeverityBadge } from "../../components/status-badge";
import { shortDigest } from "../artifacts/artifact-utils";

const historyKey = "harborPublicCatalog";
const reloadKey = "harbor-console-public-catalog-reload";

type CatalogData = {
  projects: ProjectSummary[];
  repositories: RepositorySummary[];
  artifacts: HarborArtifact[];
  pagination: ControlPagination;
};

const emptyData: CatalogData = {
  projects: [],
  repositories: [],
  artifacts: [],
  pagination: { page: 1, page_size: 20, total: 0 },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, Math.trunc(parsed)))
    : fallback;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizePublicCatalogState(
  value: unknown,
): PublicCatalogState | undefined {
  const saved = asRecord(value);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(stringValue(saved.url));
  } catch {
    return undefined;
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return undefined;
  }
  const level = stringValue(saved.level) as PublicCatalogLevel;
  if (!(["projects", "repositories", "artifacts"] as const).includes(level)) {
    return undefined;
  }

  let project = stringValue(saved.project).slice(0, 255);
  let repository = stringValue(saved.repository).slice(0, 1024);
  if (level === "projects") {
    project = "";
    repository = "";
  } else if (!project) {
    return undefined;
  }
  if (level === "repositories") repository = "";
  if (level === "artifacts" && !repository) return undefined;

  return {
    url: parsedUrl.toString().replace(/\/$/, ""),
    skip_tls_verify: Boolean(saved.skip_tls_verify),
    level,
    project,
    repository,
    page: boundedInteger(saved.page, 1, 1, 1_000_000),
    page_size: boundedInteger(saved.page_size, 20, 1, 100),
    query: stringValue(saved.query).slice(0, 255),
    depth: boundedInteger(saved.depth, 0, 0, 1_000_000),
  };
}

function historyCatalogState(value: unknown): PublicCatalogState | undefined {
  return normalizePublicCatalogState(asRecord(value)[historyKey]);
}

function catalogHistoryPayload(catalog: PublicCatalogState) {
  return {
    ...asRecord(window.history.state),
    [historyKey]: catalog,
  };
}

function writeHistory(
  method: "pushState" | "replaceState",
  catalog: PublicCatalogState,
) {
  window.history[method](
    catalogHistoryPayload(catalog),
    "",
    window.location.href,
  );
}

function removeHistoryState() {
  const current = asRecord(window.history.state);
  if (!(historyKey in current)) return;
  const { [historyKey]: removedCatalog, ...next } = current;
  void removedCatalog;
  window.history.replaceState(
    Object.keys(next).length ? next : null,
    "",
    window.location.href,
  );
}

export function createPublicCatalogState(
  url: string,
  skipTlsVerify: boolean,
): PublicCatalogState {
  return {
    url,
    skip_tls_verify: skipTlsVerify,
    level: "projects",
    project: "",
    repository: "",
    page: 1,
    page_size: 20,
    query: "",
    depth: 1,
  };
}

export function openPublicCatalogHistory(catalog: PublicCatalogState) {
  writeHistory("pushState", catalog);
  window.sessionStorage.removeItem(reloadKey);
}

export function restorePublicCatalogState(): PublicCatalogState | undefined {
  const fromHistory = historyCatalogState(window.history.state);
  const serialized = window.sessionStorage.getItem(reloadKey);
  window.sessionStorage.removeItem(reloadKey);
  if (fromHistory) return fromHistory;
  if (!serialized) return undefined;
  try {
    const restored = normalizePublicCatalogState(JSON.parse(serialized));
    return restored ? { ...restored, depth: 0 } : undefined;
  } catch {
    return undefined;
  }
}

function requestFromCatalog(catalog: PublicCatalogState): PublicCatalogRequest {
  return {
    url: catalog.url,
    skip_tls_verify: catalog.skip_tls_verify,
    project: catalog.project,
    repository: catalog.repository,
    page: catalog.page,
    page_size: catalog.page_size,
    query: catalog.query,
  };
}

function repositoryDisplayName(project: string, repository: string): string {
  const prefix = `${project}/`;
  return repository.startsWith(prefix)
    ? repository.slice(prefix.length)
    : repository;
}

function artifactSeverity(artifact: HarborArtifact): string {
  const reports = Object.values(artifact.scan_overview ?? {});
  for (const severity of ["Critical", "High", "Medium", "Low", "None"]) {
    if (
      reports.some(
        (report) => report.severity?.toLowerCase() === severity.toLowerCase(),
      )
    ) {
      return severity;
    }
  }
  return "Unknown";
}

function LoadingRows() {
  const { t } = useLocale();
  return (
    <div className="loading-rows" role="status" aria-label={t("正在载入")}>
      {Array.from({ length: 7 }, (_, index) => (
        <div className="skeleton-line" key={index} />
      ))}
    </div>
  );
}

function EmptyCatalog({
  icon,
  title,
  description,
}: {
  icon: "folder" | "package";
  title: string;
  description: string;
}) {
  const { t } = useLocale();
  return (
    <div className="empty-state">
      <span className="state-icon">
        <Icon name={icon} />
      </span>
      <h2>{t(title)}</h2>
      <p>{t(description)}</p>
    </div>
  );
}

function PublicProjectsTable({
  items,
  openProject,
}: {
  items: ProjectSummary[];
  openProject: (project: string) => void;
}) {
  const { locale, t } = useLocale();
  if (!items.length) {
    return (
      <EmptyCatalog
        icon="folder"
        title="没有公开项目"
        description="当前 Harbor 实例没有返回可匿名访问的项目。"
      />
    );
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t("项目")}</th>
            <th>{t("所有者")}</th>
            <th>{t("仓库")}</th>
            <th className="table-cell-time">{t("创建时间")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((project) => (
            <tr
              className="clickable-row"
              key={project.project_id ?? project.name}
              onClick={() => openProject(project.name)}
            >
              <td>
                <div className="cell-title">
                  <span className="cell-icon">
                    <Icon name="folder" />
                  </span>
                  <span className="cell-stack">
                    <strong>{project.name}</strong>
                    <small>
                      {t(project.registry_id ? "镜像代理项目" : "公开访问")}
                    </small>
                  </span>
                </div>
              </td>
              <td>{project.owner_name ?? "-"}</td>
              <td>{formatNumber(project.repo_count, locale)}</td>
              <td className="table-cell-time">
                {formatDate(project.creation_time, locale)}
              </td>
              <td>
                <button
                  className="icon-button"
                  type="button"
                  title={t("打开公开项目")}
                  aria-label={t("打开公开项目")}
                  onClick={(event) => {
                    event.stopPropagation();
                    openProject(project.name);
                  }}
                >
                  <Icon name="chevron" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PublicRepositoriesTable({
  items,
  project,
  openRepository,
}: {
  items: RepositorySummary[];
  project: string;
  openRepository: (repository: string) => void;
}) {
  const { locale, t } = useLocale();
  if (!items.length) {
    return (
      <EmptyCatalog
        icon="package"
        title="没有公开仓库"
        description="该项目当前没有可匿名读取的镜像仓库。"
      />
    );
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t("公开仓库")}</th>
            <th>{t("制品")}</th>
            <th>{t("拉取")}</th>
            <th className="table-cell-time">{t("最近更新")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((repository) => (
            <tr
              className="clickable-row"
              key={repository.id ?? repository.name}
              onClick={() => openRepository(repository.name)}
            >
              <td>
                <div className="cell-title">
                  <span className="cell-icon">
                    <Icon name="package" />
                  </span>
                  <span className="cell-stack">
                    <strong>
                      {repositoryDisplayName(project, repository.name)}
                    </strong>
                    <small>{repository.description ?? repository.name}</small>
                  </span>
                </div>
              </td>
              <td>{formatNumber(repository.artifact_count, locale)}</td>
              <td>{formatNumber(repository.pull_count, locale)}</td>
              <td className="table-cell-time">
                {formatDate(repository.update_time, locale)}
              </td>
              <td>
                <button
                  className="icon-button"
                  type="button"
                  title={t("查看公开制品")}
                  aria-label={t("查看公开制品")}
                  onClick={(event) => {
                    event.stopPropagation();
                    openRepository(repository.name);
                  }}
                >
                  <Icon name="chevron" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArtifactArchitecture({ artifact }: { artifact: HarborArtifact }) {
  const { locale, t } = useLocale();
  const referenceCount = artifact.references?.length ?? 0;
  const mediaType = artifact.manifest_media_type ?? "";
  if (
    referenceCount ||
    mediaType.includes("index") ||
    mediaType.includes("manifest.list")
  ) {
    return (
      <span className="badge badge-blue">
        {t("多架构")} · {formatNumber(referenceCount || 1, locale)}
      </span>
    );
  }
  const platform = [
    artifact.extra_attrs?.os,
    artifact.extra_attrs?.architecture,
  ]
    .filter(Boolean)
    .join("/");
  return <span className="badge">{platform || t("未知")}</span>;
}

function PublicArtifactsTable({
  items,
  host,
  repository,
  onNotice,
}: {
  items: HarborArtifact[];
  host: string;
  repository: string;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const runtime = useMemo(() => loadPreferences().runtime, []);

  async function copyPullCommand(
    event: MouseEvent<HTMLButtonElement>,
    tag: string,
  ) {
    event.stopPropagation();
    const command = `${runtime} pull ${host}/${repository}:${tag}`;
    try {
      await navigator.clipboard.writeText(command);
      onNotice(t("拉取命令已复制"));
    } catch {
      onNotice(t("浏览器未允许复制，请手动复制拉取命令。"), true);
    }
  }

  if (!items.length) {
    return (
      <EmptyCatalog
        icon="package"
        title="没有公开制品"
        description="该仓库当前没有可匿名读取的制品。"
      />
    );
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Tag / {t("摘要")}</th>
            <th>{t("架构")}</th>
            <th>{t("风险")}</th>
            <th>{t("大小")}</th>
            <th>{t("推送时间")}</th>
            <th>{t("拉取")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((artifact) => {
            const tags = artifact.tags ?? [];
            const pullTag = tags[0]?.name;
            return (
              <tr key={artifact.id ?? artifact.digest}>
                <td>
                  <span className="cell-stack">
                    <strong>
                      {tags.length
                        ? tags.slice(0, 3).map((tag) => (
                            <span className="badge" key={tag.id ?? tag.name}>
                              {tag.name}
                            </span>
                          ))
                        : t("无 Tag")}
                    </strong>
                    <small className="mono" title={artifact.digest}>
                      {shortDigest(artifact.digest)}
                    </small>
                  </span>
                </td>
                <td>
                  <ArtifactArchitecture artifact={artifact} />
                </td>
                <td>
                  <SeverityBadge severity={artifactSeverity(artifact)} />
                </td>
                <td>{formatBytes(artifact.size, locale)}</td>
                <td className="table-cell-time">
                  {formatDate(artifact.push_time, locale)}
                </td>
                <td>
                  {pullTag ? (
                    <button
                      className="button button-small"
                      type="button"
                      onClick={(event) => void copyPullCommand(event, pullTag)}
                    >
                      <Icon name="copy" />
                      <span>{t("复制拉取命令")}</span>
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PublicCatalogView({
  initialCatalog,
  onClose,
  onNotice,
}: {
  initialCatalog: PublicCatalogState;
  onClose: (catalog: PublicCatalogState) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const [catalog, setCatalog] = useState(initialCatalog);
  const [search, setSearch] = useState(initialCatalog.query);
  const [data, setData] = useState<CatalogData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  const host = useMemo(() => {
    try {
      return new URL(catalog.url).host;
    } catch {
      return catalog.url;
    }
  }, [catalog.url]);

  const close = useCallback(() => {
    const current = catalogRef.current;
    onClose(current);
    window.sessionStorage.removeItem(reloadKey);
    if (current.depth > 0) {
      window.history.go(-current.depth);
    } else {
      removeHistoryState();
    }
  }, [onClose]);

  useEffect(() => {
    document.title = `${t("公开镜像目录")} · ${t("Harbor 控制台")}`;
  }, [t]);

  useEffect(() => {
    if (!historyCatalogState(window.history.state)) {
      writeHistory("replaceState", initialCatalog);
    }
    const handlePopState = (event: PopStateEvent) => {
      const restored = historyCatalogState(event.state);
      window.sessionStorage.removeItem(reloadKey);
      if (!restored) {
        onClose(catalogRef.current);
        return;
      }
      setCatalog(restored);
      setSearch(restored.query);
    };
    const saveReloadState = () => {
      window.sessionStorage.setItem(
        reloadKey,
        JSON.stringify(catalogRef.current),
      );
    };
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", saveReloadState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", saveReloadState);
    };
  }, [initialCatalog, onClose]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const request = requestFromCatalog(catalog);
    const load =
      catalog.level === "projects"
        ? publicCatalogApi.projects(request, controller.signal).then((result) =>
            setData({
              ...emptyData,
              projects: result.items,
              pagination: result.pagination,
            }),
          )
        : catalog.level === "repositories"
          ? publicCatalogApi
              .repositories(request, controller.signal)
              .then((result) =>
                setData({
                  ...emptyData,
                  repositories: result.items,
                  pagination: result.pagination,
                }),
              )
          : publicCatalogApi
              .artifacts(request, controller.signal)
              .then((result) =>
                setData({
                  ...emptyData,
                  artifacts: result.items,
                  pagination: result.pagination,
                }),
              );
    void load
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }
        setError(
          loadError instanceof ApiError || loadError instanceof Error
            ? loadError.message
            : String(loadError),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [catalog]);

  function transition(next: PublicCatalogState, push: boolean) {
    setCatalog(next);
    setSearch(next.query);
    writeHistory(push ? "pushState" : "replaceState", next);
  }

  function navigate(level: PublicCatalogLevel) {
    const next: PublicCatalogState = {
      ...catalog,
      level,
      project: level === "projects" ? "" : catalog.project,
      repository: "",
      page: 1,
      query: "",
      depth: catalog.depth + 1,
    };
    transition(next, true);
  }

  function openProject(project: string) {
    transition(
      {
        ...catalog,
        level: "repositories",
        project,
        repository: "",
        page: 1,
        query: "",
        depth: catalog.depth + 1,
      },
      true,
    );
  }

  function openRepository(repository: string) {
    transition(
      {
        ...catalog,
        level: "artifacts",
        repository,
        page: 1,
        query: "",
        depth: catalog.depth + 1,
      },
      true,
    );
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    transition({ ...catalog, page: 1, query: search.trim() }, false);
  }

  function changePage(page: number) {
    transition({ ...catalog, page: Math.max(1, page) }, false);
  }

  const title =
    catalog.level === "projects"
      ? t("公开项目")
      : catalog.level === "repositories"
        ? catalog.project
        : repositoryDisplayName(catalog.project, catalog.repository);
  const subtitle =
    catalog.level === "projects"
      ? `${host} · ${t("仅显示 Harbor 标记为公开的项目")}`
      : catalog.level === "repositories"
        ? t("项目 {project} 中可匿名拉取的镜像仓库").replace(
            "{project}",
            catalog.project,
          )
        : t("{repository} 中可匿名读取的制品与 Tag").replace(
            "{repository}",
            catalog.repository,
          );

  return (
    <div id="public-catalog-view" className="public-catalog-view">
      <header className="public-catalog-header">
        <HarborBrand
          compact
          href="#"
          label="公开目录"
          ariaLabel="返回 Harbor 控制台登录"
          onClick={close}
        />
        <div className="connect-header-actions">
          <LanguageSwitch compact />
          <button className="button button-small" type="button" onClick={close}>
            <Icon name="arrow-left" />
            <span>{t("返回登录")}</span>
          </button>
        </div>
      </header>
      <main className="public-catalog-main">
        <section className="public-catalog-heading">
          <div>
            <span className="eyebrow">{t("匿名只读访问")}</span>
            <h1 id="public-catalog-title">{title}</h1>
            <p id="public-catalog-subtitle">{subtitle}</p>
          </div>
          <form
            id="public-catalog-search"
            className="public-catalog-search"
            hidden={catalog.level === "artifacts"}
            onSubmit={submitSearch}
          >
            <Icon name="search" />
            <input
              name="query"
              type="search"
              aria-label={t(
                catalog.level === "projects" ? "搜索公开项目" : "搜索镜像仓库",
              )}
              maxLength={255}
              placeholder={t(
                catalog.level === "projects" ? "搜索公开项目" : "搜索镜像仓库",
              )}
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <button className="button button-small" type="submit">
              {t("搜索")}
            </button>
          </form>
        </section>
        <nav
          id="public-catalog-breadcrumb"
          className="public-catalog-breadcrumb"
          aria-label={t("公开目录路径")}
        >
          <button type="button" onClick={() => navigate("projects")}>
            {t("公开项目")}
          </button>
          {catalog.project ? (
            <>
              <Icon name="chevron" />
              <button type="button" onClick={() => navigate("repositories")}>
                {catalog.project}
              </button>
            </>
          ) : null}
          {catalog.repository ? (
            <>
              <Icon name="chevron" />
              <span>
                {repositoryDisplayName(catalog.project, catalog.repository)}
              </span>
            </>
          ) : null}
        </nav>
        <section
          id="public-catalog-content"
          className="table-shell public-catalog-content"
        >
          {loading ? <LoadingRows /> : null}
          {!loading && error ? (
            <div className="error-state public-catalog-error" role="alert">
              <div>
                <span className="state-icon">
                  <Icon name="alert" />
                </span>
                <h2>{t("公开目录载入失败")}</h2>
                <p>{error}</p>
                <button
                  className="button button-small"
                  type="button"
                  onClick={() => changePage(catalog.page)}
                >
                  <Icon name="refresh" />
                  <span>{t("重新尝试")}</span>
                </button>
              </div>
            </div>
          ) : null}
          {!loading && !error && catalog.level === "projects" ? (
            <PublicProjectsTable
              items={data.projects}
              openProject={openProject}
            />
          ) : null}
          {!loading && !error && catalog.level === "repositories" ? (
            <PublicRepositoriesTable
              items={data.repositories}
              project={catalog.project}
              openRepository={openRepository}
            />
          ) : null}
          {!loading && !error && catalog.level === "artifacts" ? (
            <PublicArtifactsTable
              items={data.artifacts}
              host={host}
              repository={catalog.repository}
              onNotice={onNotice}
            />
          ) : null}
          {!loading &&
          !error &&
          (data.pagination.total > data.pagination.page_size ||
            data.pagination.page > 1) ? (
            <Pagination
              pagination={data.pagination}
              onPageChange={changePage}
            />
          ) : null}
        </section>
      </main>
      <footer className="public-catalog-footer">
        <span>{t("Harbor API v2 匿名访问")}</span>
        <span>{t("只读模式")}</span>
        <span>{t("不创建登录会话")}</span>
      </footer>
    </div>
  );
}
