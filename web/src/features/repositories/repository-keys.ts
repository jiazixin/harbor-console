// Query keys of the repositories domain: domain → resource → parameters.
export const repositoryKeys = {
  all: ["repositories"] as const,
  assets: (projectNames: string[]) =>
    ["repositories", "assets", projectNames] as const,
};
