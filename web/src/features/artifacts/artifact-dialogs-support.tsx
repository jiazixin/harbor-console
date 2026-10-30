import { projectKeys } from "../projects/public";
import { repositoryKeys } from "../repositories/public";
import { artifactKeys } from "./artifact-keys";

export const affectedQueries = [
  artifactKeys.all,
  repositoryKeys.all,
  projectKeys.all,
];

export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function settledFailures(
  tasks: Promise<unknown>[],
): Promise<number> {
  const results = await Promise.allSettled(tasks);
  return results.filter((result) => result.status === "rejected").length;
}
