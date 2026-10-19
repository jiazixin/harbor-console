import type { ReplicationExecution, ReplicationPolicy } from "../../app/models";

type SortValue = number | string;

export function policyDirection(policy: ReplicationPolicy): "pull" | "push" {
  return (policy.dest_registry?.id ?? 0) > 0 ? "push" : "pull";
}

/** Name of the remote registry on the other side of the policy. */
export function policyRemote(policy: ReplicationPolicy): string {
  const remote =
    policyDirection(policy) === "push"
      ? policy.dest_registry
      : policy.src_registry;
  return remote?.name ?? `#${String(remote?.id ?? "-")}`;
}

function timestamp(value: string | undefined): number {
  const parsed = new Date(value ?? "").getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function executionDuration(execution: ReplicationExecution): number {
  const start = timestamp(execution.start_time);
  const end = timestamp(execution.end_time);
  return start && end ? Math.max(0, end - start) : 0;
}

function executionTaskCount(execution: ReplicationExecution): number {
  return (
    execution.total ??
    (execution.succeed ?? 0) +
      (execution.failed ?? 0) +
      (execution.in_progress ?? 0) +
      (execution.stopped ?? 0)
  );
}

function compareSortValues(
  left: SortValue,
  right: SortValue,
  locale: string,
): number {
  if (typeof left === "number" && typeof right === "number")
    return left - right;
  return left.toString().localeCompare(right.toString(), locale);
}

/** Sorts by a field name, where a leading "-" means descending order. */
function sortByField<T>(
  items: readonly T[],
  sort: string,
  locale: string,
  valueOf: (item: T, field: string) => SortValue,
): T[] {
  const descending = sort.startsWith("-");
  const field = sort.replace(/^-/, "");
  return [...items].sort((left, right) => {
    const comparison = compareSortValues(
      valueOf(left, field),
      valueOf(right, field),
      locale,
    );
    return descending ? -comparison : comparison;
  });
}

function policySortValue(policy: ReplicationPolicy, field: string): SortValue {
  switch (field) {
    case "id":
      return policy.id ?? 0;
    case "name":
      return policy.name ?? "";
    case "direction":
      return policyDirection(policy);
    case "remote":
      return policyRemote(policy);
    case "trigger":
      return policy.trigger?.type ?? "";
    case "enabled":
      return Number(policy.enabled);
    default:
      return timestamp(policy.update_time);
  }
}

export function sortPolicies(
  policies: readonly ReplicationPolicy[],
  sort: string,
  locale: string,
): ReplicationPolicy[] {
  return sortByField(policies, sort, locale, policySortValue);
}

export function sortExecutions(
  executions: readonly ReplicationExecution[],
  policies: readonly ReplicationPolicy[],
  sort: string,
  locale: string,
): ReplicationExecution[] {
  const policyNames = new Map(
    policies.map((policy) => [policy.id, policy.name ?? ""]),
  );
  return sortByField(executions, sort, locale, (execution, field) => {
    switch (field) {
      case "id":
        return execution.id ?? 0;
      case "policy":
        return policyNames.get(execution.policy_id) ?? "";
      case "trigger":
        return execution.trigger ?? "";
      case "status":
        return execution.status ?? "";
      case "tasks":
        return executionTaskCount(execution);
      case "duration":
        return executionDuration(execution);
      default:
        return timestamp(execution.start_time);
    }
  });
}
