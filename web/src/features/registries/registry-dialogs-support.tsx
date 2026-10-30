import { registryKeys } from "./registry-keys";

export const affectedQueries = [registryKeys.all];

export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
