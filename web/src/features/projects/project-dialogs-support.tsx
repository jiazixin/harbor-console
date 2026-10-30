import { artifactKeys } from "../artifacts/public";
import { repositoryKeys } from "../repositories/public";
import { projectKeys } from "./project-keys";

export const affectedQueries = [
  projectKeys.all,
  repositoryKeys.all,
  artifactKeys.all,
];

export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
