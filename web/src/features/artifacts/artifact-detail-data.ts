import { controlApi } from "../../app/api-client";
import { errorText, UserInputError } from "../../app/errors";
import type {
  ArtifactAccessory,
  ArtifactLabelCollection,
  ArtifactTag,
  ArtifactVulnerabilityReport,
  ControlList,
  HarborArtifact,
  ProjectLabel,
  ProjectSummary,
} from "../../app/models";
import { useLoadedQuery } from "../../app/use-loaded-query";
import type { IconName } from "../../components/icons-support";
import {
  artifactAdditionTabs,
  type ArtifactDetailTab,
  artifactHasAddition,
} from "./artifact-detail-sections-support";
import { artifactKeys } from "./artifact-keys";

export const artifactPageSize = 50;
const additionTabKeys = Object.keys(
  artifactAdditionTabs,
) as (keyof typeof artifactAdditionTabs)[];

export const artifactTabs: {
  key: ArtifactDetailTab;
  label: string;
  icon: IconName;
}[] = [
  { key: "overview", label: "概览", icon: "package" },
  { key: "tags", label: "Tag", icon: "tag" },
  { key: "labels", label: "标签", icon: "tag" },
  { key: "vulnerabilities", label: "漏洞", icon: "shield" },
  ...additionTabKeys.map((key) => ({
    key,
    label: artifactAdditionTabs[key].label,
    icon: artifactAdditionTabs[key].icon,
  })),
  { key: "accessories", label: "关联制品", icon: "database" },
];

const artifactTabNames = new Set<ArtifactDetailTab>(
  artifactTabs.map((tab) => tab.key),
);

export type ArtifactRouteState = {
  project: string;
  repository: string;
  reference: string;
  tab: ArtifactDetailTab;
  page: number;
};

export type ArtifactDetailData = {
  artifact: HarborArtifact;
  tags?: ControlList<ArtifactTag>;
  labels?: ArtifactLabelCollection;
  vulnerabilities?: ArtifactVulnerabilityReport;
  vulnerabilityError?: string;
  /** Harbor has no vulnerability report because the artifact was never scanned. */
  notScanned?: boolean;
  accessories?: ControlList<ArtifactAccessory>;
  accessoryError?: string;
  addition?: unknown;
  additionError?: string;
};

export type ArtifactActionContext = {
  project: string;
  repository: string;
  artifact: HarborArtifact;
};

export type ArtifactDetailAction =
  | (ArtifactActionContext & { kind: "add-tag" })
  | (ArtifactActionContext & {
      kind: "attach-label";
      labels: ProjectLabel[];
    })
  | (ArtifactActionContext & { kind: "copy" })
  | (ArtifactActionContext & { kind: "delete" })
  | (ArtifactActionContext & {
      kind: "delete-accessory";
      accessory: ArtifactAccessory;
    })
  | (ArtifactActionContext & { kind: "delete-tag"; tag: ArtifactTag })
  | (ArtifactActionContext & {
      kind: "remove-label";
      label: ProjectLabel;
    })
  | (ArtifactActionContext & { kind: "scan" })
  | (ArtifactActionContext & { kind: "scan-log"; reportId: string })
  | (ArtifactActionContext & {
      kind: "stop-scan";
      scanType: "sbom" | "vulnerability";
    });

export function positiveInteger(value: string | null): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function artifactTab(value: string | null): ArtifactDetailTab {
  return artifactTabNames.has(value as ArtifactDetailTab)
    ? (value as ArtifactDetailTab)
    : "overview";
}

export function artifactPath(
  state: ArtifactRouteState,
  updates: Partial<Pick<ArtifactRouteState, "page" | "reference" | "tab">> = {},
): string {
  const next = { ...state, ...updates };
  const query = new URLSearchParams();
  if (next.page > 1) query.set("page", String(next.page));
  if (next.tab !== "overview") query.set("tab", next.tab);
  const base = `projects/${encodeURIComponent(next.project)}/repositories/${encodeURIComponent(next.repository)}/artifacts/${encodeURIComponent(next.reference)}`;
  return `${base}${query.size ? `?${query}` : ""}`;
}

export function repositoryPath(project: string, repository: string): string {
  return `projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function abortIfNeeded(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
}

async function loadArtifactLabels(
  state: ArtifactRouteState,
  artifact: HarborArtifact,
  signal: AbortSignal,
): Promise<ArtifactLabelCollection> {
  const globalLabels = controlApi.list<ProjectLabel>(
    "labels",
    { scope: "g", page: 1, page_size: 100, sort: "name" },
    signal,
  );
  const projectLabels = controlApi
    .data<ProjectSummary>("project", { project: state.project }, signal)
    .then((project) => {
      if (!project) throw new UserInputError("项目不存在");
      return controlApi.list<ProjectLabel>(
        "labels",
        {
          scope: "p",
          project_id: project.project_id ?? 0,
          page: 1,
          page_size: 100,
          sort: "name",
        },
        signal,
      );
    });
  const [projectResult, globalResult] = await Promise.allSettled([
    projectLabels,
    globalLabels,
  ]);
  abortIfNeeded(signal);
  const available: ProjectLabel[] = [];
  const errors: string[] = [];
  if (projectResult.status === "fulfilled") {
    available.push(...projectResult.value.items);
  } else {
    errors.push(errorText(projectResult.reason));
  }
  if (globalResult.status === "fulfilled") {
    available.push(...globalResult.value.items);
  } else {
    errors.push(errorText(globalResult.reason));
  }
  return {
    attached: artifact.labels ?? [],
    available,
    load_error: errors.length ? errors.join("；") : undefined,
  };
}

async function loadArtifactData(
  state: ArtifactRouteState,
  signal: AbortSignal,
): Promise<ArtifactDetailData> {
  const artifact = await controlApi.data<HarborArtifact>(
    "artifact",
    {
      project: state.project,
      repository: state.repository,
      reference: state.reference,
      with_tag: true,
      with_label: true,
      with_scan_overview: true,
      with_sbom_overview: true,
      with_accessory: true,
      with_immutable_status: true,
    },
    signal,
  );
  if (!artifact) throw new UserInputError("制品不存在");
  const result: ArtifactDetailData = { artifact };
  if (state.tab === "tags") {
    result.tags = await controlApi.list<ArtifactTag>(
      "artifact-tags",
      {
        project: state.project,
        repository: state.repository,
        reference: state.reference,
        page: state.page,
        page_size: artifactPageSize,
        sort: "-push_time",
        with_immutable_status: true,
      },
      signal,
    );
  } else if (state.tab === "labels") {
    result.labels = await loadArtifactLabels(state, artifact, signal);
  } else if (state.tab === "vulnerabilities") {
    if (!Object.keys(artifact.scan_overview ?? {}).length) {
      result.notScanned = true;
      return result;
    }
    try {
      result.vulnerabilities =
        await controlApi.data<ArtifactVulnerabilityReport>(
          "artifact-vulnerabilities",
          {
            project: state.project,
            repository: state.repository,
            reference: state.reference,
          },
          signal,
        );
    } catch (error) {
      if (isAbortError(error)) throw error;
      result.vulnerabilityError = errorText(error);
    }
  } else if (state.tab === "accessories") {
    try {
      result.accessories = await controlApi.list<ArtifactAccessory>(
        "artifact-accessories",
        {
          project: state.project,
          repository: state.repository,
          reference: state.reference,
          page: state.page,
          page_size: artifactPageSize,
          sort: "-creation_time",
        },
        signal,
      );
    } catch (error) {
      if (isAbortError(error)) throw error;
      result.accessoryError = errorText(error);
      result.accessories = {
        items: [],
        pagination: { page: 1, page_size: artifactPageSize, total: 0 },
      };
    }
  } else if (
    state.tab in artifactAdditionTabs &&
    artifactHasAddition(
      artifact,
      state.tab as keyof typeof artifactAdditionTabs,
    )
  ) {
    try {
      result.addition = await controlApi.data<unknown>(
        "artifact-addition",
        {
          project: state.project,
          repository: state.repository,
          reference: state.reference,
          addition:
            artifactAdditionTabs[state.tab as keyof typeof artifactAdditionTabs]
              .addition,
        },
        signal,
      );
    } catch (error) {
      if (isAbortError(error)) throw error;
      result.additionError = errorText(error);
    }
  }
  abortIfNeeded(signal);
  return result;
}

/** Loads the artifact and the data of the selected tab. */
export function useArtifactDetail(routeState: ArtifactRouteState) {
  // Another artifact's data would be misleading while this one loads.
  return useLoadedQuery(
    artifactKeys.detail(routeState),
    (signal) => loadArtifactData(routeState, signal),
    { keepPrevious: false },
  );
}
