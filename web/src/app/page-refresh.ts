import { useQueryClient } from "@tanstack/react-query";
import { artifactKeys } from "../features/artifacts/artifact-keys";
import { preheatKeys } from "../features/preheat/preheat-keys";
import { projectKeys } from "../features/projects/project-keys";
import { registryKeys } from "../features/registries/registry-keys";
import { replicationKeys } from "../features/replication/replication-keys";
import { repositoryKeys } from "../features/repositories/repository-keys";
import { securityKeys } from "../features/security/security-keys";

const pageKeys = {
  artifact: artifactKeys.all,
  preheat: preheatKeys.all,
  project: projectKeys.all,
  registries: registryKeys.all,
  replication: replicationKeys.all,
  repository: repositoryKeys.all,
  security: securityKeys.all,
};

export type ReloadablePage = keyof typeof pageKeys;

/** Refreshes affected server data without remounting pages or discarding drafts. */
export function usePageRefresh() {
  const queryClient = useQueryClient();
  return {
    reloadPage: (page: ReloadablePage) => {
      // Query observers report refetch failures through their normal error UI.
      void queryClient.invalidateQueries({ queryKey: pageKeys[page] });
    },
  };
}
