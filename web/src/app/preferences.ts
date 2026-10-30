import { z } from "zod";
import {
  readStoredItem,
  writeStoredItem,
} from "../lib/browser-storage/storage";
import { decodeJson } from "../lib/json/decode-json";
export type ConsolePreferences = {
  dateTimezone: "local" | "utc";
  registryView: "card" | "list";
  repositoryView: "card" | "list";
  runtime: "docker" | "nerdctl" | "podman";
};

const storageKey = "harbor-console-preferences-v1";

const preferencesSchema = z.object({
  dateTimezone: z.enum(["local", "utc"]).catch("local").optional(),
  registryView: z.enum(["card", "list"]).catch("list").optional(),
  repositoryView: z.enum(["card", "list"]).catch("list").optional(),
  runtime: z.enum(["docker", "nerdctl", "podman"]).catch("docker").optional(),
});

function readStoredPreferences(): Partial<ConsolePreferences> {
  try {
    return decodeJson(
      readStoredItem("localStorage", storageKey) ?? "{}",
      preferencesSchema,
    );
  } catch {
    // Corrupt optional browser preferences reset to the documented defaults.
    return {};
  }
}

function isRuntime(value: unknown): value is ConsolePreferences["runtime"] {
  return value === "docker" || value === "nerdctl" || value === "podman";
}

export function loadPreferences(): ConsolePreferences {
  const stored = readStoredPreferences();
  return {
    dateTimezone: stored.dateTimezone === "utc" ? "utc" : "local",
    runtime: isRuntime(stored.runtime) ? stored.runtime : "docker",
    repositoryView: stored.repositoryView === "card" ? "card" : "list",
    registryView: stored.registryView === "card" ? "card" : "list",
  };
}

export function savePreferences(preferences: ConsolePreferences): void {
  writeStoredItem("localStorage", storageKey, JSON.stringify(preferences));
}

/** Resolves the user's selected timezone for the pure display formatters. */
export function displayTimeZone(): string | undefined {
  return loadPreferences().dateTimezone === "utc" ? "UTC" : undefined;
}
