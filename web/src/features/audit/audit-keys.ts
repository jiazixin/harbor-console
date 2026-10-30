// Query keys of the audit domain: domain → resource → parameters.
export const auditKeys = {
  all: ["audit"] as const,
  events: ["audit", "events"] as const,
  logs: (parameters: unknown) => ["audit", "logs", parameters] as const,
};
