import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorText } from "../app/errors";
import type { LogTimezone } from "./structured-log-support";

type LogTask = { id: number };

/** Loads one task log; changing its owner or task cancels the previous query. */
export function useTaskLog<Task extends LogTask>(
  loadLog: (task: Task, signal: AbortSignal) => Promise<string | undefined>,
  queryKey: readonly unknown[],
) {
  const client = useQueryClient();
  const owner = JSON.stringify(queryKey);
  const [selection, setSelection] = useState<{ owner: string; task: Task }>();
  const task = selection?.owner === owner ? selection.task : undefined;
  function setTask(next: Task | undefined) {
    setSelection(next ? { owner, task: next } : undefined);
  }
  const [timezone, setTimezone] = useState<LogTimezone>("local");
  const query = useQuery({
    queryKey: [...queryKey, task?.id],
    enabled: task !== undefined,
    queryFn: ({ signal }) =>
      task
        ? loadLog(task, signal).then((value) => value ?? "")
        : Promise.resolve(""),
  });
  async function open(next: Task) {
    if (task?.id === next.id) {
      await client.cancelQueries({
        queryKey: [...queryKey, task.id],
        exact: true,
      });
      await query.refetch();
      return;
    }
    setTask(next);
  }
  function close() {
    setTask(undefined);
  }
  return {
    task,
    log: query.data ?? "",
    loading: query.isFetching,
    error: query.error ? errorText(query.error) : "",
    timezone,
    setTimezone,
    open,
    close,
  };
}

export type TaskLog<Task extends LogTask> = ReturnType<typeof useTaskLog<Task>>;
