import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { errorText } from "./errors";

/** The loading contract the console's pages use for one query. */
export type LoadedQuery<T> = {
  data: T | undefined;
  loading: boolean;
  error: string;
  reload: () => void;
};

/**
 * Runs queryFn under TanStack Query. By default the previous data stays while
 * a new key loads, so pages do not flash empty; keepPrevious: false clears it
 * when the previous data would be misleading. error is the failure's text: the
 * request wrapper already localizes server errors.
 */
export function useLoadedQuery<T>(
  queryKey: QueryKey,
  queryFn: (signal: AbortSignal) => Promise<T>,
  {
    enabled = true,
    keepPrevious = true,
  }: { enabled?: boolean; keepPrevious?: boolean } = {},
): LoadedQuery<T> {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => queryFn(signal),
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    enabled,
  });
  return {
    data: query.data,
    loading: query.isFetching,
    error: query.error ? errorText(query.error) : "",
    // refetch alone joins a first load still in flight; a reload restarts it.
    reload: () =>
      void queryClient
        .cancelQueries({ queryKey, exact: true })
        .then(() => query.refetch()),
  };
}
