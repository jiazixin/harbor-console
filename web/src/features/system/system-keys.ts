// Query keys of the system domain: domain → resource → parameters.
export const systemKeys = {
  all: ["system"] as const,
  volumes: ["system", "volumes"] as const,
};
