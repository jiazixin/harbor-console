import { useCallback, useEffect, useRef, useState } from "react";

import { controlApi, loadAllControlItems } from "../../app/api-client";
import type {
  ProjectLabel,
  Registry,
  ReplicationAdapterInfo,
  ReplicationExecution,
  ReplicationPolicy,
} from "../../app/models";
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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

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
  const [policies, setPolicies] = useState<ReplicationPolicy[]>();
  const [executions, setExecutions] = useState<ReplicationExecution[]>();
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [labels, setLabels] = useState<ProjectLabel[]>([]);
  const [localInfo, setLocalInfo] = useState<ReplicationAdapterInfo>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const latestRequest = useRef(0);
  const reload = useCallback(
    () => setReloadToken((current) => current + 1),
    [],
  );
  const { policy_id: policyId, status, trigger } = executionFilters;

  useEffect(() => {
    const controller = new AbortController();
    const request = latestRequest.current + 1;
    latestRequest.current = request;
    const isLatest = () => latestRequest.current === request;
    setLoading(true);
    setError("");
    void Promise.all([
      loadAllControlItems<ReplicationPolicy>(
        "replication-policies",
        policyFilter ? { name: policyFilter } : {},
        controller.signal,
      ),
      tab === "executions"
        ? loadAllControlItems<ReplicationExecution>(
            "replication-executions",
            executionQuery({ policy_id: policyId, status, trigger }),
            controller.signal,
          )
        : Promise.resolve([]),
      controlApi.list<Registry>(
        "registries",
        { page: 1, page_size: 100, sort: "name" },
        controller.signal,
      ),
      controlApi
        .list<ProjectLabel>(
          "labels",
          { page: 1, page_size: 100, sort: "name", scope: "g" },
          controller.signal,
        )
        .then((collection) => collection.items)
        .catch(() => []),
      controlApi
        .data<ReplicationAdapterInfo>(
          "registry-info",
          { id: 0 },
          controller.signal,
        )
        .catch(() => undefined),
    ])
      .then(([policyItems, executionItems, registryList, labelItems, info]) => {
        if (!isLatest()) return;
        setPolicies(policyItems);
        setExecutions(executionItems);
        setRegistries(registryList.items);
        setLabels(labelItems);
        setLocalInfo(info);
      })
      .catch((loadError: unknown) => {
        if (isAbortError(loadError) || !isLatest()) return;
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted && isLatest()) setLoading(false);
      });
    return () => controller.abort();
  }, [policyFilter, policyId, reloadToken, status, tab, trigger]);

  return {
    policies,
    executions,
    registries,
    labels,
    localInfo,
    error,
    loading,
    reload,
  };
}
