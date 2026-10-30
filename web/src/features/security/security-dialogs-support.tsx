import { securityKeys } from "./security-keys";

export const affectedQueries = [securityKeys.all];

export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
