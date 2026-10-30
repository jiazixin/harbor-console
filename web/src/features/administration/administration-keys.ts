// Query keys of the administration domain: domain → resource → parameters.
export const administrationKeys = {
  all: ["administration"] as const,
  section: (section: string, parameters: unknown) =>
    ["administration", section, parameters] as const,
  ldapUsers: (term: string) => ["administration", "ldap-users", term] as const,
  operationLog: (kind: string, id: unknown) =>
    ["administration", "operation-log", kind, id] as const,
};
