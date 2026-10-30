// Query keys of the registries domain: domain → resource → parameters.
export const registryKeys = {
  all: ["registries"] as const,
  page: ["registries", "page"] as const,
};
