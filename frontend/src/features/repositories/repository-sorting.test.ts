import { describe, expect, it } from "vitest";

import type { RepositorySummary } from "../../app/models";
import { sortRepositories } from "./repository-sorting";

const repositories: RepositorySummary[] = [
  {
    id: 1,
    name: "platform/api",
    artifact_count: 12,
    pull_count: 9,
    creation_time: "2026-07-20T08:00:00Z",
    update_time: "2026-07-29T08:00:00Z",
  },
  {
    id: 2,
    name: "platform/worker",
    artifact_count: 3,
    pull_count: 18,
    creation_time: "2026-07-18T08:00:00Z",
    update_time: "2026-07-30T08:00:00Z",
  },
];

describe("repository sorting", () => {
  it.each([
    ["name", ["platform/api", "platform/worker"]],
    ["-name", ["platform/worker", "platform/api"]],
    ["artifact_count", ["platform/worker", "platform/api"]],
    ["-artifact_count", ["platform/api", "platform/worker"]],
    ["pull_count", ["platform/api", "platform/worker"]],
    ["-pull_count", ["platform/worker", "platform/api"]],
    ["creation_time", ["platform/worker", "platform/api"]],
    ["-creation_time", ["platform/api", "platform/worker"]],
    ["update_time", ["platform/api", "platform/worker"]],
    ["-update_time", ["platform/worker", "platform/api"]],
  ])("sorts %s across the complete repository set", (sort, expected) => {
    expect(
      sortRepositories(repositories, sort, "zh-CN").map(({ name }) => name),
    ).toEqual(expected);
  });
});
