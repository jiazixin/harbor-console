import { controlApi } from "../../app/api-client";
import { errorText } from "../../app/errors";
import type { ReplicationAdapterInfo } from "../../app/models";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { replicationKeys } from "./replication-keys";
import {
  defaultCapability,
  type ReplicationDirection,
} from "./replication-policy-form";
export function useReplicationCapabilities({
  direction,
  initialDirection,
  localInfo,
  registryId,
}: {
  direction: ReplicationDirection;
  initialDirection: ReplicationDirection;
  localInfo?: ReplicationAdapterInfo;
  registryId: string;
}) {
  const remoteId = Number(registryId);
  const capabilityQuery = useLoadedQuery(
    replicationKeys.capabilities({ direction, localInfo, remoteId }),
    async (signal) => {
      const results = await Promise.allSettled([
        direction === "push" && localInfo
          ? Promise.resolve(localInfo)
          : controlApi.data<ReplicationAdapterInfo>(
              "registry-info",
              { id: direction === "push" ? 0 : remoteId },
              signal,
            ),
        controlApi.data<ReplicationAdapterInfo>(
          "registry-info",
          { id: remoteId },
          signal,
        ),
      ]);
      return {
        capability:
          results[0].status === "fulfilled" && results[0].value
            ? results[0].value
            : defaultCapability,
        remote:
          results[1].status === "fulfilled" && results[1].value
            ? results[1].value
            : defaultCapability,
        error: results
          .filter((result) => result.status === "rejected")
          .map((result) => errorText(result.reason))
          .join("；"),
      };
    },
    { enabled: remoteId > 0 },
  );
  const loaded = capabilityQuery.data;
  const capability =
    loaded?.capability ??
    (initialDirection === "push"
      ? (localInfo ?? defaultCapability)
      : defaultCapability);
  const remoteInfo = loaded?.remote ?? defaultCapability;
  const capabilityError = loaded?.error ?? "";
  const capabilityReady =
    remoteId > 0 && loaded !== undefined && !capabilityQuery.loading;

  return { capability, remoteInfo, capabilityError, capabilityReady };
}
