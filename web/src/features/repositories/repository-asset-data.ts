import { useCallback, useEffect, useMemo, useState } from "react";

import { loadAllControlItems } from "../../app/api-client";
import type { ConsoleRoute } from "../../app/hash-router";
import type {
  ControlPagination,
  Locale,
  ProjectSummary,
  RepositorySummary,
} from "../../app/models";
import { createSortValues } from "../../components/data-table";
import { compareRepositories } from "./repository-sorting";

const defaultPageSize = 50;
export const pageSizeOptions = [20, 50, 100];
const defaultSort = "-artifact_count";
const validSorts = createSortValues([
  "artifact_count",
  "pull_count",
  "update_time",
  "creation_time",
  "name",
]);
/** Projects whose repositories load at the same time. */
const parallelProjectLoads = 4;

/** A repository together with the project it belongs to. */
export type RepositoryAsset = RepositorySummary & { project_name: string };

export type RepositoryAssetRoute = {
  page: number;
  pageSize: number;
  query: string;
  project: string;
  sort: string;
};

export type RepositoryAssetData = {
  repositories: RepositoryAsset[];
  /** One "project: message" entry per project that could not be read. */
  failures: string[];
};

export function parseRepositoryAssetRoute(
  route: ConsoleRoute,
): RepositoryAssetRoute {
  const requestedPageSize = Number.parseInt(
    route.query.get("page_size") ?? String(defaultPageSize),
    10,
  );
  const requestedSort = route.query.get("sort") ?? defaultSort;
  return {
    page: Math.max(1, Number.parseInt(route.query.get("page") ?? "1", 10) || 1),
    pageSize: pageSizeOptions.includes(requestedPageSize)
      ? requestedPageSize
      : defaultPageSize,
    query: route.query.get("q") ?? "",
    project: route.query.get("project") ?? "",
    sort: validSorts.has(requestedSort) ? requestedSort : defaultSort,
  };
}

export function repositoryAssetPath(
  state: RepositoryAssetRoute,
  updates: Partial<RepositoryAssetRoute> = {},
): string {
  const next = { ...state, ...updates };
  const query = new URLSearchParams();
  if (next.page > 1) query.set("page", String(next.page));
  if (next.query) query.set("q", next.query);
  if (next.pageSize !== defaultPageSize) {
    query.set("page_size", String(next.pageSize));
  }
  if (next.sort !== defaultSort) query.set("sort", next.sort);
  if (next.project) query.set("project", next.project);
  return `repositories${query.size ? `?${query}` : ""}`;
}

export function artifactListPath(repository: RepositoryAsset): string {
  return `projects/${encodeURIComponent(repository.project_name)}/repositories/${encodeURIComponent(repository.name)}/artifacts`;
}

export function projectRepositoriesHref(project: string): string {
  return `#/projects/${encodeURIComponent(project)}/repositories`;
}

/** Repository names include the project prefix; the list shows it separately. */
export function nameWithinProject(repository: RepositoryAsset): string {
  const prefix = `${repository.project_name}/`;
  return repository.name.startsWith(prefix)
    ? repository.name.slice(prefix.length)
    : repository.name;
}

export function repositoryAssetKey(repository: RepositoryAsset): string {
  return `${repository.project_name}-${String(repository.id ?? repository.name)}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadProjectRepositories(
  project: string,
  signal: AbortSignal,
): Promise<RepositoryAsset[]> {
  const items = await loadAllControlItems<RepositorySummary>(
    "repositories",
    { project, sort: "name" },
    signal,
  );
  return items.map((repository) => ({
    ...repository,
    project_name: project,
  }));
}

/**
 * Reads the repositories of every project with a few parallel workers. A
 * project that fails is reported but does not hide the other projects.
 */
async function loadRepositoryAssets(
  projects: ProjectSummary[],
  signal: AbortSignal,
): Promise<RepositoryAssetData> {
  const repositories: RepositoryAsset[] = [];
  const failures: string[] = [];
  let nextProjectIndex = 0;
  const workerCount = Math.min(parallelProjectLoads, projects.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextProjectIndex < projects.length) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const project = projects[nextProjectIndex];
      nextProjectIndex += 1;
      try {
        repositories.push(
          ...(await loadProjectRepositories(project.name, signal)),
        );
      } catch (loadError) {
        if (isAbortError(loadError)) throw loadError;
        failures.push(`${project.name}: ${errorText(loadError)}`);
      }
    }
  });
  await Promise.all(workers);
  if (!repositories.length && failures.length) throw new Error(failures[0]);
  return { repositories, failures };
}

export function useRepositoryAssets(projects: ProjectSummary[]) {
  const [data, setData] = useState<RepositoryAssetData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(
    () => setReloadToken((current) => current + 1),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void loadRepositoryAssets(projects, controller.signal)
      .then(setData)
      .catch((loadError: unknown) => {
        if (!isAbortError(loadError)) setError(errorText(loadError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [projects, reloadToken]);

  return { data, loading, error, reload };
}

/** Filters, sorts and pages the loaded repositories for the current route. */
export function useRepositoryAssetPage(
  repositories: RepositoryAsset[],
  route: RepositoryAssetRoute,
  locale: Locale,
): { visible: RepositoryAsset[]; pagination: ControlPagination } {
  const matching = useMemo(() => {
    const term = route.query.trim().toLocaleLowerCase(locale);
    const matchesTerm = (repository: RepositoryAsset) =>
      !term ||
      repository.name.toLocaleLowerCase(locale).includes(term) ||
      repository.project_name.toLocaleLowerCase(locale).includes(term);
    return repositories
      .filter(
        (repository) =>
          (!route.project || repository.project_name === route.project) &&
          matchesTerm(repository),
      )
      .toSorted((left, right) =>
        compareRepositories(left, right, route.sort, locale),
      );
  }, [locale, repositories, route.project, route.query, route.sort]);

  const totalPages = Math.max(1, Math.ceil(matching.length / route.pageSize));
  const page = Math.min(route.page, totalPages);
  return {
    visible: matching.slice((page - 1) * route.pageSize, page * route.pageSize),
    pagination: {
      page,
      page_size: route.pageSize,
      total: matching.length,
    },
  };
}
