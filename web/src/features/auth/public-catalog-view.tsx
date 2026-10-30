import {
  type MouseEvent,
  type SubmitEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { publicCatalogApi } from "../../app/api-client";
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
import { displayTimeZone, loadPreferences } from "../../app/preferences";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { EmptyState } from "../../components/empty-state";
import { ErrorView } from "../../components/error-view";
import { FormInput } from "../../components/form-input";
import { HarborBrand } from "../../components/harbor-brand";
import { Icon } from "../../components/icon";
import { LanguageSwitch } from "../../components/language-switch";
import { Pagination } from "../../components/pagination";
import { SeverityBadge } from "../../components/severity-badge";
import uiStyles0 from "../../components/shared-ui.module.css";
import {
  readStoredItem,
  removeStoredItem,
  writeStoredItem,
} from "../../lib/browser-storage/storage";
import { createClassNames } from "../../lib/css/class-names";
import {
  formatBytes,
  formatDate,
  formatNumber,
} from "../../lib/format/formatters";
import { objectSchema } from "../../lib/json/decode-json";
import { artifactPlatformReferences, shortDigest } from "../artifacts/public";
import styles from "./auth.module.css";
import { publicCatalogKeys } from "./public-catalog-keys";

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
  const result = objectSchema.safeParse(value);
  return result.success ? result.data : {};
}

function boundedInteger({
  value,
  fallback,
  minimum,
  maximum,
}: {
  value: unknown;
  fallback: number;
  minimum: number;
  maximum: number;
}): number {
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
  const level = saved.level;
  if (
    level !== "projects" &&
    level !== "repositories" &&
    level !== "artifacts"
  ) {
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
    page: boundedInteger({
      value: saved.page,
      fallback: 1,
      minimum: 1,
      maximum: 1_000_000,
    }),
    page_size: boundedInteger({
      value: saved.page_size,
      fallback: 20,
      minimum: 1,
      maximum: 100,
    }),
    query: stringValue(saved.query).slice(0, 255),
    depth: boundedInteger({
      value: saved.depth,
      fallback: 0,
      minimum: 0,
      maximum: 1_000_000,
    }),
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
  const next = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== historyKey),
  );
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
  removeStoredItem("sessionStorage", reloadKey);
}

export function restorePublicCatalogState(): PublicCatalogState | undefined {
  const fromHistory = historyCatalogState(window.history.state);
  const serialized = readStoredItem("sessionStorage", reloadKey);
  removeStoredItem("sessionStorage", reloadKey);
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
    <div
      className={resolveClasses(styles.loadingRows)}
      role="status"
      aria-label={t("正在载入")}
    >
      {Array.from({ length: 7 }, (_, index) => (
        <div className={resolveClasses(styles.skeletonLine)} key={index} />
      ))}
    </div>
  );
}

type PublicProjectsTableProps = {
  items: ProjectSummary[];
  openProject: (project: string) => void;
};

function PublicProjectsTable({ items, openProject }: PublicProjectsTableProps) {
  const { locale, t } = useLocale();
  if (!items.length) {
    return (
      <EmptyState
        icon="folder"
        title="没有公开项目"
        description="当前 Harbor 实例没有返回可匿名访问的项目。"
      />
    );
  }
  return (
    <div className={resolveClasses("table-scroll")}>
      <table>
        <thead>
          <tr>
            <th>{t("项目")}</th>
            <th>{t("所有者")}</th>
            <th>{t("仓库")}</th>
            <th className={resolveClasses("table-cell-time")}>
              {t("创建时间")}
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((project) => (
            <tr
              className={resolveClasses("clickable-row")}
              key={project.project_id ?? project.name}
              onClick={() => {
                openProject(project.name);
              }}
            >
              <td>
                <div className={resolveClasses("cell-title")}>
                  <span className={resolveClasses("cell-icon")}>
                    <Icon name="folder" />
                  </span>
                  <span className={resolveClasses("cell-stack")}>
                    <strong>{project.name}</strong>
                    <small>
                      {t(project.registry_id ? "镜像代理项目" : "公开访问")}
                    </small>
                  </span>
                </div>
              </td>
              <td>{project.owner_name ?? "-"}</td>
              <td>{formatNumber(project.repo_count, locale)}</td>
              <td className={resolveClasses("table-cell-time")}>
                {formatDate(project.creation_time, {
                  locale: locale,
                  timeZone: displayTimeZone(),
                })}
              </td>
              <td>
                <button
                  className={resolveClasses("icon-button")}
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

type PublicRepositoriesTableProps = {
  items: RepositorySummary[];
  project: string;
  openRepository: (repository: string) => void;
};

function PublicRepositoriesTable({
  items,
  project,
  openRepository,
}: PublicRepositoriesTableProps) {
  const { locale, t } = useLocale();
  if (!items.length) {
    return (
      <EmptyState
        icon="package"
        title="没有公开仓库"
        description="该项目当前没有可匿名读取的镜像仓库。"
      />
    );
  }
  return (
    <div className={resolveClasses("table-scroll")}>
      <table>
        <thead>
          <tr>
            <th>{t("公开仓库")}</th>
            <th>{t("制品")}</th>
            <th>{t("拉取")}</th>
            <th className={resolveClasses("table-cell-time")}>
              {t("最近更新")}
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((repository) => (
            <tr
              className={resolveClasses("clickable-row")}
              key={repository.id ?? repository.name}
              onClick={() => {
                openRepository(repository.name);
              }}
            >
              <td>
                <div className={resolveClasses("cell-title")}>
                  <span className={resolveClasses("cell-icon")}>
                    <Icon name="package" />
                  </span>
                  <span className={resolveClasses("cell-stack")}>
                    <strong>
                      {repositoryDisplayName(project, repository.name)}
                    </strong>
                    <small>{repository.description ?? repository.name}</small>
                  </span>
                </div>
              </td>
              <td>{formatNumber(repository.artifact_count, locale)}</td>
              <td>{formatNumber(repository.pull_count, locale)}</td>
              <td className={resolveClasses("table-cell-time")}>
                {formatDate(repository.update_time, {
                  locale: locale,
                  timeZone: displayTimeZone(),
                })}
              </td>
              <td>
                <button
                  className={resolveClasses("icon-button")}
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

type ArtifactArchitectureProps = { artifact: HarborArtifact };

function ArtifactArchitecture({ artifact }: ArtifactArchitectureProps) {
  const { locale, t } = useLocale();
  const referenceCount = artifactPlatformReferences(artifact).length;
  const mediaType = artifact.manifest_media_type ?? "";
  if (
    referenceCount ||
    mediaType.includes("index") ||
    mediaType.includes("manifest.list")
  ) {
    return (
      <span className={resolveClasses("badge badge-blue")}>
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
  return (
    <span className={resolveClasses("badge")}>{platform || t("未知")}</span>
  );
}

type PublicArtifactsTableProps = {
  items: HarborArtifact[];
  host: string;
  repository: string;
  onNotice: (message: string, error?: boolean) => void;
};

function PublicArtifactsTable({
  items,
  host,
  repository,
  onNotice,
}: PublicArtifactsTableProps) {
  const { locale, t } = useLocale();
  const runtime = (() => loadPreferences().runtime)();

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
      <EmptyState
        icon="package"
        title="没有公开制品"
        description="该仓库当前没有可匿名读取的制品。"
      />
    );
  }
  return (
    <div className={resolveClasses("table-scroll")}>
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
                  <span className={resolveClasses("cell-stack")}>
                    <strong>
                      {tags.length
                        ? tags.slice(0, 3).map((tag) => (
                            <span
                              className={resolveClasses("badge")}
                              key={tag.id ?? tag.name}
                            >
                              {tag.name}
                            </span>
                          ))
                        : t("无 Tag")}
                    </strong>
                    <small
                      className={resolveClasses("mono")}
                      title={artifact.digest}
                    >
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
                <td className={resolveClasses("table-cell-time")}>
                  {formatDate(artifact.push_time, {
                    locale: locale,
                    timeZone: displayTimeZone(),
                  })}
                </td>
                <td>
                  {pullTag ? (
                    <button
                      className={resolveClasses("button button-small")}
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

type PublicCatalogViewProps = {
  initialCatalog: PublicCatalogState;
  onClose: (catalog: PublicCatalogState) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function PublicCatalogView({
  initialCatalog,
  onClose,
  onNotice,
}: PublicCatalogViewProps) {
  const { t } = useLocale();
  const [catalog, setCatalog] = useState(initialCatalog);
  const [search, setSearch] = useState(initialCatalog.query);
  const catalogRequest = requestFromCatalog(catalog);
  const catalogQuery = usePublicCatalogData({ catalog, catalogRequest });
  const data = catalogQuery.data ?? emptyData;
  const loading = catalogQuery.loading;
  const error = catalogQuery.error;
  // Event handlers registered once read the latest catalog through this ref.
  const catalogRef = useRef(catalog);
  useEffect(() => {
    const previous = catalogRef.current;
    catalogRef.current = catalog;
    return () => {
      catalogRef.current = previous;
    };
  }, [catalog]);

  const host = (() => {
    try {
      return new URL(catalog.url).host;
    } catch {
      return catalog.url;
    }
  })();

  const close = useCallback(() => {
    const current = catalogRef.current;
    onClose(current);
    removeStoredItem("sessionStorage", reloadKey);
    if (current.depth > 0) {
      window.history.go(-current.depth);
    } else {
      removeHistoryState();
    }
  }, [onClose]);

  useEffect(() => {
    const previous = document.title;
    document.title = `${t("公开镜像目录")} · ${t("Harbor 控制台")}`;
    return () => {
      document.title = previous;
    };
  }, [t]);

  useEffect(() => {
    if (!historyCatalogState(window.history.state)) {
      writeHistory("replaceState", initialCatalog);
    }
    const handlePopState = (event: PopStateEvent) => {
      const restored = historyCatalogState(event.state);
      removeStoredItem("sessionStorage", reloadKey);
      if (!restored) {
        onClose(catalogRef.current);
        return;
      }
      setCatalog(restored);
      setSearch(restored.query);
    };
    const saveReloadState = () => {
      writeStoredItem(
        "sessionStorage",
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

  function submitSearch(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    transition({ ...catalog, page: 1, query: search.trim() }, false);
  }

  function changePage(page: number) {
    transition({ ...catalog, page: Math.max(1, page) }, false);
  }

  const title = (() => {
    if (catalog.level === "projects") {
      return t("公开项目");
    }
    if (catalog.level === "repositories") {
      return catalog.project;
    }
    return repositoryDisplayName(catalog.project, catalog.repository);
  })();
  const subtitle = (() => {
    if (catalog.level === "projects") {
      return `${host} · ${t("仅显示 Harbor 标记为公开的项目")}`;
    }
    if (catalog.level === "repositories") {
      return t("项目 {project} 中可匿名拉取的镜像仓库").replace(
        "{project}",
        catalog.project,
      );
    }
    return t("{repository} 中可匿名读取的制品与 Tag").replace(
      "{repository}",
      catalog.repository,
    );
  })();

  return (
    <div
      id="public-catalog-view"
      className={resolveClasses(styles.publicCatalogView)}
    >
      <header className={resolveClasses(styles.publicCatalogHeader)}>
        <HarborBrand
          compact
          href="#"
          label="公开目录"
          ariaLabel="返回 Harbor 控制台登录"
          onClick={close}
        />
        <div className={resolveClasses(styles.connectHeaderActions)}>
          <LanguageSwitch compact />
          <button
            className={resolveClasses("button button-small")}
            type="button"
            onClick={close}
          >
            <Icon name="arrow-left" />
            <span>{t("返回登录")}</span>
          </button>
        </div>
      </header>
      <main className={resolveClasses(styles.publicCatalogMain)}>
        <section className={resolveClasses(styles.publicCatalogHeading)}>
          <div>
            <span className={resolveClasses("eyebrow")}>
              {t("匿名只读访问")}
            </span>
            <h1 id="public-catalog-title">{title}</h1>
            <p id="public-catalog-subtitle">{subtitle}</p>
          </div>
          <form
            id="public-catalog-search"
            className={resolveClasses(styles.publicCatalogSearch)}
            hidden={catalog.level === "artifacts"}
            onSubmit={submitSearch}
          >
            <Icon name="search" />
            <FormInput
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
              onChange={(event) => {
                setSearch(event.currentTarget.value);
              }}
            />
            <button
              className={resolveClasses("button button-small")}
              type="submit"
            >
              {t("搜索")}
            </button>
          </form>
        </section>
        <nav
          id="public-catalog-breadcrumb"
          className={resolveClasses(styles.publicCatalogBreadcrumb)}
          aria-label={t("公开目录路径")}
        >
          <button
            type="button"
            onClick={() => {
              navigate("projects");
            }}
          >
            {t("公开项目")}
          </button>
          {catalog.project ? (
            <>
              <Icon name="chevron" />
              <button
                type="button"
                onClick={() => {
                  navigate("repositories");
                }}
              >
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
          className={resolveClasses(
            `table-shell ${styles.publicCatalogContent}`,
          )}
        >
          {loading ? <LoadingRows /> : null}
          {!loading && error ? (
            <ErrorView
              title="公开目录载入失败"
              message={error}
              retry={() => {
                changePage(catalog.page);
              }}
            />
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
      <footer className={resolveClasses(styles.publicCatalogFooter)}>
        <span>{t("Harbor API v2 匿名访问")}</span>
        <span>{t("只读模式")}</span>
        <span>{t("不创建登录会话")}</span>
      </footer>
    </div>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "language-switch": uiStyles0.languageSwitch,
  "table-scroll": uiStyles0.tableScroll,
  "table-cell-time": uiStyles0.tableCellTime,
  "clickable-row": uiStyles0.clickableRow,
  "cell-title": uiStyles0.cellTitle,
  "cell-icon": uiStyles0.cellIcon,
  "cell-stack": uiStyles0.cellStack,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
  badge: uiStyles0.badge,
  "badge-blue": uiStyles0.badgeBlue,
  mono: uiStyles0.mono,
  "button-small": uiStyles0.buttonSmall,
  eyebrow: uiStyles0.eyebrow,
  "table-shell": uiStyles0.tableShell,
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

function usePublicCatalogData({
  catalog,
  catalogRequest,
}: {
  catalog: PublicCatalogState;
  catalogRequest: PublicCatalogRequest;
}) {
  return useLoadedQuery(
    publicCatalogKeys.list(catalog.level, catalogRequest),
    (signal): Promise<CatalogData> =>
      (() => {
        if (catalog.level === "projects") {
          return publicCatalogApi
            .projects(catalogRequest, signal)
            .then((result) => ({
              ...emptyData,
              projects: result.items,
              pagination: result.pagination,
            }));
        }
        if (catalog.level === "repositories") {
          return publicCatalogApi
            .repositories(catalogRequest, signal)
            .then((result) => ({
              ...emptyData,
              repositories: result.items,
              pagination: result.pagination,
            }));
        }
        return publicCatalogApi
          .artifacts(catalogRequest, signal)
          .then((result) => ({
            ...emptyData,
            artifacts: result.items,
            pagination: result.pagination,
          }));
      })(),
  );
}
