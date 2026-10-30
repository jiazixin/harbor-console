// Query keys of the application shell: resource → parameters.
export const shellKeys = {
  instances: ["harbor-instances"] as const,
  search: (term: string) => ["search", term] as const,
};
