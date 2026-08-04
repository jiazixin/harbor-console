export type ConsolePreferences = {
  dateTimezone: "local" | "utc";
  registryView: "card" | "list";
  repositoryView: "card" | "list";
  runtime: "docker" | "nerdctl" | "podman";
};

const storageKey = "harbor-console-preferences-v1";

function readStoredPreferences(): Partial<ConsolePreferences> {
  try {
    return JSON.parse(
      window.localStorage.getItem(storageKey) ?? "{}",
    ) as Partial<ConsolePreferences>;
  } catch {
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
  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}
