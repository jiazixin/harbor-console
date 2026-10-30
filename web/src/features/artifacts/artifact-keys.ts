// Query keys of the artifacts domain: domain → resource → parameters.
export const artifactKeys = {
  all: ["artifacts"] as const,
  repository: (parameters: unknown) =>
    ["artifacts", "repository", parameters] as const,
  detail: (parameters: unknown) => ["artifacts", "detail", parameters] as const,
  scanLog: (parameters: unknown) =>
    ["artifacts", "scan-log", parameters] as const,
};
