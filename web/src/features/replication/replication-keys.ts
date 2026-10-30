// Query keys of the replication domain: domain → resource → parameters.
export const replicationKeys = {
  taskLog: (resource: string, parameters: unknown) =>
    ["replication", resource, parameters] as const,
  all: ["replication"] as const,
  page: (parameters: unknown) => ["replication", "page", parameters] as const,
  capabilities: (parameters: unknown) =>
    ["replication", "capabilities", parameters] as const,
  executionTasks: (parameters: unknown) =>
    ["replication", "execution-tasks", parameters] as const,
};
