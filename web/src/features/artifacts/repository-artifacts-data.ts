import { useCallback, useEffect, useState } from "react";

import { controlApi } from "../../app/api-client";
import type { ConsoleRoute } from "../../app/hash-router";
import type {
  ControlList,
  HarborArtifact,
  ProjectLabel,
  ProjectSummary,
  RepositorySummary,
} from "../../app/models";
import { artifactMatchesScanStatus } from "./artifact-utils";

const pageSize = 50;
export const artifactTypes = ["IMAGE", "CHART", "CNAB", "WASM"] as const;
const tagStates = ["tagged", "untagged"] as const;
const scanStatuses = [
  "success",
  "running",
  "error",
  "stopped",
  "unscanned",
] as const;

type ArtifactType = (typeof artifactTypes)[number] | "";
type TagState = (typeof tagStates)[number] | "";
type ScanStatus = (typeof scanStatuses)[number] | "";

export type RepositoryRouteState = {
  project: string;
  repository: string;
  page: number;
  query: string;
  artifactType: ArtifactType;
  tagState: TagState;
  labelId: string;
  scanStatus: ScanStatus;
};

type RepositoryData = {
  repository: RepositorySummary;
  project: ProjectSummary;
  artifacts: ControlList<HarborArtifact>;
  labels: ProjectLabel[];
};

export type RepositoryArtifactAction =
  | {
      kind: "attach-label";
      project: string;
      repository: string;
      artifacts: HarborArtifact[];
      labels: ProjectLabel[];
    }
  | {
      kind: "copy";
      project: string;
      repository: string;
      artifact: HarborArtifact;
    }
  | {
      kind: "delete";
      project: string;
      repository: string;
      artifacts: HarborArtifact[];
    }
  | {
      kind: "remove-label";
      project: string;
      repository: string;
      artifacts: HarborArtifact[];
      labels: ProjectLabel[];
    };

function positiveInteger(value: string | null): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function oneOf<T extends string>(
  value: string | null,
  candidates: readonly T[],
): T | "" {
  return candidates.includes(value as T) ? (value as T) : "";
}

export function parseRepositoryRoute(
  route: ConsoleRoute,
): RepositoryRouteState {
  return {
    project: route.segments[1] ?? "",
    repository: route.segments[3] ?? "",
    page: positiveInteger(route.query.get("page")),
    query: route.query.get("q") ?? "",
    artifactType: oneOf(route.query.get("type"), artifactTypes),
    tagState: oneOf(route.query.get("tags"), tagStates),
    labelId: /^\d+$/.test(route.query.get("label") ?? "")
      ? (route.query.get("label") ?? "")
      : "",
    scanStatus: oneOf(route.query.get("scan"), scanStatuses),
  };
}

function artifactQuery(state: RepositoryRouteState): string {
  const filters: string[] = [];
  if (state.query) filters.push(`tags=~${state.query}`);
  else if (state.tagState === "tagged") filters.push("tags=*");
  else if (state.tagState === "untagged") filters.push("tags=nil");
  if (state.artifactType) filters.push(`type=${state.artifactType}`);
  if (/^[1-9]\d*$/.test(state.labelId)) {
    filters.push(`labels=(${state.labelId})`);
  }
  return filters.join(",");
}

function artifactParameters(
  state: RepositoryRouteState,
  page: number,
  requestedPageSize: number,
) {
  return {
    project: state.project,
    repository: state.repository,
    page,
    page_size: requestedPageSize,
    sort: "-push_time",
    q: artifactQuery(state),
    with_tag: true,
    with_label: true,
    with_scan_overview: true,
    with_sbom_overview: true,
    with_immutable_status: true,
    with_accessory: true,
  };
}

async function loadArtifacts(
  state: RepositoryRouteState,
  signal: AbortSignal,
): Promise<ControlList<HarborArtifact>> {
  if (!state.scanStatus) {
    return controlApi.list<HarborArtifact>(
      "artifacts",
      artifactParameters(state, state.page, pageSize),
      signal,
    );
  }
  const all: HarborArtifact[] = [];
  for (let page = 1; page <= 200; page += 1) {
    const result = await controlApi.list<HarborArtifact>(
      "artifacts",
      artifactParameters(state, page, 100),
      signal,
    );
    all.push(...result.items);
    if (page * 100 >= result.pagination.total || result.items.length < 100) {
      break;
    }
    if (page === 200) {
      throw new Error(
        "扫描状态筛选最多处理 20000 个制品，请先使用类型、Tag 或标签缩小范围",
      );
    }
  }
  const filtered = all.filter((artifact) =>
    artifactMatchesScanStatus(artifact, state.scanStatus),
  );
  const start = (state.page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    pagination: {
      page: state.page,
      page_size: pageSize,
      total: filtered.length,
    },
  };
}

function emptyLabelList(): ControlList<ProjectLabel> {
  return { items: [], pagination: { page: 1, page_size: 100, total: 0 } };
}

/** Labels are optional on this page; a failed request shows no labels. */
function loadLabels(
  scope: { scope: "g" } | { scope: "p"; project_id: number },
  signal: AbortSignal,
): Promise<ControlList<ProjectLabel>> {
  return controlApi
    .list<ProjectLabel>(
      "labels",
      { ...scope, page: 1, page_size: 100, sort: "name" },
      signal,
    )
    .catch(emptyLabelList);
}

async function loadRepositoryData(
  state: RepositoryRouteState,
  signal: AbortSignal,
): Promise<RepositoryData> {
  const projectRequest = controlApi.data<ProjectSummary>(
    "project",
    { project: state.project },
    signal,
  );
  // Every request joins one Promise.all, so an aborted navigation never
  // leaves a rejected request unhandled.
  const [project, repository, artifacts, projectLabels, globalLabels] =
    await Promise.all([
      projectRequest,
      controlApi.data<RepositorySummary>(
        "repository",
        { project: state.project, repository: state.repository },
        signal,
      ),
      loadArtifacts(state, signal),
      projectRequest.then((loaded) =>
        loaded
          ? loadLabels(
              { scope: "p", project_id: loaded.project_id ?? 0 },
              signal,
            )
          : emptyLabelList(),
      ),
      loadLabels({ scope: "g" }, signal),
    ]);
  if (!project) throw new Error("项目不存在");
  if (!repository) throw new Error("仓库不存在");
  return {
    repository,
    project,
    artifacts,
    labels: [...projectLabels.items, ...globalLabels.items],
  };
}

export function repositoryPath(
  state: RepositoryRouteState,
  updates: Partial<RepositoryRouteState>,
): string {
  const next = { ...state, ...updates };
  const query = new URLSearchParams();
  if (next.page > 1) query.set("page", String(next.page));
  if (next.query) query.set("q", next.query);
  if (next.artifactType) query.set("type", next.artifactType);
  if (next.tagState && !next.query) query.set("tags", next.tagState);
  if (next.labelId) query.set("label", next.labelId);
  if (next.scanStatus) query.set("scan", next.scanStatus);
  const base = `projects/${encodeURIComponent(next.project)}/repositories/${encodeURIComponent(next.repository)}/artifacts`;
  return `${base}${query.size ? `?${query}` : ""}`;
}

export function artifactPath(
  project: string,
  repository: string,
  reference: string,
): string {
  return `projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts/${encodeURIComponent(reference)}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Loads the repository, its project, one page of artifacts and the usable labels. */
export function useRepositoryData(routeState: RepositoryRouteState) {
  const [data, setData] = useState<RepositoryData>();
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
    void loadRepositoryData(routeState, controller.signal)
      .then(setData)
      .catch((loadError: unknown) => {
        if (isAbortError(loadError)) return;
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadToken, routeState]);

  return { data, loading, error, reload };
}
