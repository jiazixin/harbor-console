import { useCallback, useState } from "react";

/** Pages that remount to reload their data after a dialog changes it. */
export type ReloadablePage =
  | "artifact"
  | "preheat"
  | "project"
  | "registries"
  | "replication"
  | "repository"
  | "security";

export type PageVersions = Readonly<Record<ReloadablePage, number>>;

const initialVersions: PageVersions = {
  artifact: 0,
  preheat: 0,
  project: 0,
  registries: 0,
  replication: 0,
  repository: 0,
  security: 0,
};

/**
 * Tracks one version number per reloadable page. The page uses its version as
 * its React key, so increasing the version reloads it from Harbor.
 */
export function usePageVersions() {
  const [versions, setVersions] = useState(initialVersions);
  const reloadPage = useCallback(
    (page: ReloadablePage) =>
      setVersions((current) => ({ ...current, [page]: current[page] + 1 })),
    [],
  );
  return { versions, reloadPage };
}
