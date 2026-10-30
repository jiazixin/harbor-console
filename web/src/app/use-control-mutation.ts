import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import {
  controlApi,
  controlResult,
  type ControlWriteOptions,
} from "./api-client";

/** Sends one write; the request boundary owns the same-repository response type. */
export type ControlMutate = <T = unknown>(
  input: ControlWriteOptions,
) => Promise<T>;

/** Cancels owned writes on unmount and invalidates affected server data on success. */
export function useControlMutation(
  invalidates: readonly QueryKey[],
): ControlMutate {
  const client = useQueryClient();
  const controllers = useRef(new Set<AbortController>());
  useEffect(() => {
    const active = controllers.current;
    return () => {
      for (const controller of active) controller.abort();
      active.clear();
    };
  }, []);
  const { mutateAsync } = useMutation({
    mutationFn: (input: ControlWriteOptions) =>
      controlApi.mutate<unknown>(input),
    onSuccess: () =>
      Promise.all(
        invalidates.map((queryKey) => client.invalidateQueries({ queryKey })),
      ),
  });
  return useCallback(
    async <T = unknown>(input: ControlWriteOptions) => {
      const controller = new AbortController();
      controllers.current.add(controller);
      try {
        const response = await mutateAsync({
          ...input,
          signal: input.signal
            ? AbortSignal.any([input.signal, controller.signal])
            : controller.signal,
          idempotencyKey:
            input.method === "POST"
              ? (input.idempotencyKey ?? crypto.randomUUID())
              : undefined,
        });
        return controlResult<T>(response);
      } finally {
        controllers.current.delete(controller);
      }
    },
    [mutateAsync],
  );
}
