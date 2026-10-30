import { artifactKeys } from "../artifacts/public";
import { repositoryKeys } from "../repositories/public";
import { projectKeys } from "./project-keys";

export const affectedQueries = [
  projectKeys.all,
  repositoryKeys.all,
  artifactKeys.all,
];

export const projectRoles = [
  { value: "1", label: "项目管理员" },
  { value: "4", label: "维护者" },
  { value: "2", label: "开发者" },
  { value: "3", label: "访客" },
];

export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
