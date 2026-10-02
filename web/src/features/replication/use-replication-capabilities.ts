import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { controlApi } from "../../app/api-client";
import type { ReplicationAdapterInfo } from "../../app/models";
import {
  defaultCapability,
  type ReplicationDirection,
  type TriggerType,
} from "./replication-policy-form";
export function useReplicationCapabilities({
  direction,
  initialDirection,
  localInfo,
  registryId,
  setTrigger,
  setCopyByChunk,
}: {
  direction: ReplicationDirection;
  initialDirection: ReplicationDirection;
  localInfo?: ReplicationAdapterInfo;
  registryId: string;
  setTrigger: Dispatch<SetStateAction<TriggerType>>;
  setCopyByChunk: Dispatch<SetStateAction<boolean>>;
}) {
  const [capability, setCapability] = useState<ReplicationAdapterInfo>(
    initialDirection === "push"
      ? (localInfo ?? defaultCapability)
      : defaultCapability,
  );
  const [remoteInfo, setRemoteInfo] =
    useState<ReplicationAdapterInfo>(defaultCapability);
  const [capabilityError, setCapabilityError] = useState("");
  const [capabilityReady, setCapabilityReady] = useState(false);
  const firstCapabilityLoad = useRef(true);

  useEffect(() => {
    const controller = new AbortController();
    const remoteId = Number(registryId);
    if (!remoteId) return () => controller.abort();
    setCapabilityReady(false);
    const capabilityPromise =
      direction === "push" && localInfo
        ? Promise.resolve(localInfo)
        : controlApi.data<ReplicationAdapterInfo>(
            "registry-info",
            { id: direction === "push" ? 0 : remoteId },
            controller.signal,
          );
    void Promise.allSettled([
      capabilityPromise,
      controlApi.data<ReplicationAdapterInfo>(
        "registry-info",
        { id: remoteId },
        controller.signal,
      ),
    ]).then((results) => {
      if (controller.signal.aborted) return;
      const nextCapability =
        results[0].status === "fulfilled" && results[0].value
          ? results[0].value
          : defaultCapability;
      const nextRemote =
        results[1].status === "fulfilled" && results[1].value
          ? results[1].value
          : defaultCapability;
      setCapability(nextCapability);
      setRemoteInfo(nextRemote);
      setCapabilityError(
        results
          .filter((result) => result.status === "rejected")
          .map((result) =>
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          )
          .join("；"),
      );
      if (!firstCapabilityLoad.current) {
        const supported = (nextCapability.supported_triggers ?? []).filter(
          (value): value is TriggerType =>
            ["event_based", "manual", "scheduled"].includes(value),
        );
        setTrigger((current) =>
          supported.includes(current) ? current : (supported[0] ?? "manual"),
        );
      }
      firstCapabilityLoad.current = false;
      if (!nextRemote.supported_copy_by_chunk) setCopyByChunk(false);
      setCapabilityReady(true);
    });
    return () => controller.abort();
  }, [direction, localInfo, registryId]);

  return { capability, remoteInfo, capabilityError, capabilityReady };
}
