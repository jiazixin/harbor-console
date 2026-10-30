import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { sessionApi } from "../../app/api-client";
import type { ConnectRequest } from "../../app/models";

/** Owns authentication writes and cancels them when the login screen unmounts. */
export function useAuthentication() {
  const active = useRef<AbortController | undefined>(undefined);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );
  return useMutation({
    mutationFn: (input: ConnectRequest | undefined) => {
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      return input
        ? sessionApi.connect(input, controller.signal)
        : sessionApi.demo(controller.signal);
    },
  });
}
