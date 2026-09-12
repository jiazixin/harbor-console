import type { RepositorySummary } from "../../app/models";

type SortableRepository = RepositorySummary & { project_name?: string };

function numberValue(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function repositoryTimestamp(value: string | undefined): number {
  const parsed = new Date(value ?? "").getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function compareRepositories(
  left: SortableRepository,
  right: SortableRepository,
  sort: string,
  locale: string,
): number {
  const descending = sort.startsWith("-");
  const field = sort.replace(/^-/, "");
  let comparison: number;
  if (field === "update_time" || field === "creation_time") {
    comparison =
      repositoryTimestamp(left[field]) - repositoryTimestamp(right[field]);
  } else if (field === "artifact_count") {
    comparison =
      numberValue(left.artifact_count) - numberValue(right.artifact_count);
  } else if (field === "pull_count") {
    comparison = numberValue(left.pull_count) - numberValue(right.pull_count);
  } else {
    comparison = left.name.localeCompare(right.name, locale);
  }
  if (comparison) return descending ? -comparison : comparison;
  const projectComparison = (left.project_name ?? "").localeCompare(
    right.project_name ?? "",
    locale,
  );
  return projectComparison || left.name.localeCompare(right.name, locale);
}

export function sortRepositories<T extends SortableRepository>(
  repositories: readonly T[],
  sort: string,
  locale: string,
): T[] {
  return [...repositories].sort((left, right) =>
    compareRepositories(left, right, sort, locale),
  );
}
