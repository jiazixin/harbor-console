// Query keys of the public catalog domain: domain → resource → parameters.
export const publicCatalogKeys = {
  all: ["public-catalog"] as const,
  list: (level: string, parameters: unknown) =>
    ["public-catalog", level, parameters] as const,
};
