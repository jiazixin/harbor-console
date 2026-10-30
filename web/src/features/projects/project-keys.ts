// Query keys of the projects domain: domain → resource → parameters.
export const projectKeys = {
  directory: (parameters: unknown) =>
    ["projects", "directory", parameters] as const,
  taskLog: (resource: string, parameters: unknown) =>
    ["projects", resource, parameters] as const,
  all: ["projects"] as const,
  createSetup: ["projects", "create-setup"] as const,
  page: (parameters: unknown) => ["projects", "page", parameters] as const,
  list: (parameters: unknown) => ["projects", "list", parameters] as const,
  preheatExecutions: (parameters: unknown) =>
    ["projects", "preheat-executions", parameters] as const,
  webhookHistory: (parameters: unknown) =>
    ["projects", "webhook-history", parameters] as const,
  retention: (parameters: unknown) =>
    ["projects", "retention", parameters] as const,
};
