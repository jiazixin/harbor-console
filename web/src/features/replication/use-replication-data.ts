import { controlApi, loadAllControlItems } from "../../app/api-client";
import type {
  ProjectLabel,
  Registry,
  ReplicationAdapterInfo,
  ReplicationExecution,
  ReplicationPolicy,
} from "../../app/models";
import { optionalData } from "../../app/optional-data";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { replicationKeys } from "./replication-keys";
import type {
  ExecutionFilterValues,
  ReplicationTab,
} from "./replication-routing";

type ReplicationData = {
  policies?: ReplicationPolicy[];
  /** Loaded only while the executions tab is open. */
  executions?: ReplicationExecution[];
  /** Registries, global labels and local adapter metadata feed the policy dialog. */
  registries: Registry[];
  labels: ProjectLabel[];
  localInfo?: ReplicationAdapterInfo;
  error: string;
  loading: boolean;
  reload: () => void;
};

function executionQuery(
  filters: ExecutionFilterValues,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== ""),
  );
}

/**
 * Loads policies, executions and the reference data the policy editor needs.
 * Only the latest request may update state, so quick filter changes cannot
 * show an older response.
 */
export function useReplicationData(
  tab: ReplicationTab,
  policyFilter: string,
  executionFilters: ExecutionFilterValues,
): ReplicationData {
  const { policy_id: policyId, status, trigger } = executionFilters;
  const query = useLoadedQuery(
    replicationKeys.page({ tab, policyFilter, policyId, status, trigger }),
    async (signal) => {
      const [policies, executions, registries, labels, localInfo] =
        await Promise.all([
          loadAllControlItems<ReplicationPolicy>(
            "replication-policies",
            policyFilter ? { name: policyFilter } : {},
            signal,
          ),
          tab === "executions"
            ? loadAllControlItems<ReplicationExecution>(
                "replication-executions",
                executionQuery({ policy_id: policyId, status, trigger }),
                signal,
              )
            : Promise.resolve([]),
          controlApi.list<Registry>(
            "registries",
            { page: 1, page_size: 100, sort: "name" },
            signal,
          ),
          optionalData(
            controlApi
              .list<ProjectLabel>(
                "labels",
                { page: 1, page_size: 100, sort: "name", scope: "g" },
                signal,
              )
              .then((collection) => collection.items),
          ),
          optionalData(
            controlApi.data<ReplicationAdapterInfo>(
              "registry-info",
              { id: 0 },
              signal,
            ),
          ),
        ]);
      return {
        policies,
        executions,
        registries: registries.items,
        labels: labels.data ?? [],
        localInfo: localInfo.data,
        error: [labels.error, localInfo.error].filter(Boolean).join("；"),
      };
    },
  );
  return {
    policies: query.data?.policies,
    executions: query.data?.executions,
    registries: query.data?.registries ?? [],
    labels: query.data?.labels ?? [],
    localInfo: query.data?.localInfo,
    error: query.error || query.data?.error || "",
    loading: query.loading,
    reload: query.reload,
  };
}
