import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { controlApi } from "../../app/api-client";
import { errorText } from "../../app/errors";
import type {
  HarborDirectoryGroup,
  HarborDirectoryUser,
} from "../../app/models";
import { projectKeys } from "./project-keys";

const directoryDebounceMs = 320;

/** Debounces directory input; Query owns request cancellation and stale results. */
export function useMemberDirectoryData(input: {
  type: "user" | "group";
  query: string;
  authMode: string;
}) {
  const [term, setTerm] = useState("");
  const text = input.query.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTerm(text);
    }, directoryDebounceMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [text]);
  const result = useQuery({
    queryKey: projectKeys.directory({
      type: input.type,
      term,
      authMode: input.authMode,
    }),
    enabled: term.length > 0 && term === text,
    queryFn: async ({ signal }) => {
      if (input.type === "user") {
        const result = await controlApi.list<HarborDirectoryUser>(
          "users-search",
          { username: term, page: 1, page_size: 20 },
          signal,
        );
        return { users: result.items, groups: [] as HarborDirectoryGroup[] };
      }
      const operation =
        input.authMode === "ldap_auth"
          ? "ldap-groups-search"
          : "user-groups-search";
      const result = await controlApi.list<HarborDirectoryGroup>(
        operation,
        { groupname: term, page: 1, page_size: 20 },
        signal,
      );
      return { users: [] as HarborDirectoryUser[], groups: result.items };
    },
  });
  async function search() {
    if (term !== text) {
      setTerm(text);
      return;
    }
    await result.refetch();
  }
  const status = (() => {
    if (!text) return "idle";
    if (term !== text || result.isFetching) return "loading";
    if (result.isError) return "error";
    return "ready";
  })();
  return {
    users: result.data?.users ?? [],
    groups: result.data?.groups ?? [],
    status,
    error: result.error ? errorText(result.error) : "",
    search,
  };
}
