// Query keys of the security domain: domain → resource → parameters.
export const securityKeys = {
  all: ["security"] as const,
  section: (section: string, parameters: unknown) =>
    ["security", section, parameters] as const,
  scannerMetadata: (uuid: unknown) =>
    ["security", "scanner-metadata", uuid] as const,
};
