import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { controlApi } from "../../app/api-client";
import { LocaleProvider } from "../../app/locale-context";
import type {
  PreheatExecution,
  PreheatPolicy,
  PreheatTask,
} from "../../app/models";
import { IconSprite } from "../../components/icons";
import {
  PreheatPolicyDialog,
  RunPreheatPolicyDialog,
} from "./project-preheat-dialogs";
import { PreheatExecutionsDialog } from "./project-preheat-executions";

const policy: PreheatPolicy = {
  id: 81,
  name: "release-images",
  description: "Release images",
  project_id: 1,
  provider_id: 61,
  filters: [
    { type: "repository", value: "release/**", future_filter: true },
    { type: "tag", value: "v*" },
  ],
  trigger: {
    type: "manual",
    trigger_setting: { cron: "", future_trigger: "preserved" },
  },
  enabled: true,
  extra_attrs: {
    scope: "single_seed_peer",
    cluster_ids: [1, 2],
    future_provider_option: { enabled: true },
  },
  creation_time: "2026-08-01T00:00:00Z",
  update_time: "2026-08-02T00:00:00Z",
};

function renderDialog(content: React.ReactNode) {
  return render(
    <LocaleProvider>
      <IconSprite />
      {content}
    </LocaleProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("project preheat dialogs", () => {
  it("creates a normalized Harbor preheat policy payload", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onSaved = vi.fn();
    renderDialog(
      <PreheatPolicyDialog
        project="platform"
        projectId={1}
        providers={[
          { id: 61, provider: "dragonfly", enabled: true, default: true },
        ]}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "策略名称" }), {
      target: { value: "parity-policy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建策略" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "preheat-policies",
      { project: "platform" },
      "POST",
      {
        name: "parity-policy",
        description: "",
        project_id: 1,
        provider_id: 61,
        filters: JSON.stringify([
          { type: "repository", value: "**" },
          { type: "tag", value: "**" },
        ]),
        trigger: JSON.stringify({
          type: "manual",
          trigger_setting: { cron: "" },
        }),
        enabled: true,
        extra_attrs: JSON.stringify({ scope: "single_seed_peer" }),
      },
    );
  });

  it("runs the current policy without leaking response fields or dropping future Harbor fields", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onStarted = vi.fn();

    renderDialog(
      <RunPreheatPolicyDialog
        project="platform"
        policy={policy}
        onClose={vi.fn()}
        onStarted={onStarted}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "开始预热" }));

    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "preheat-policy",
      { project: "platform", name: "release-images" },
      "POST",
      {
        id: 81,
        name: "release-images",
        description: "Release images",
        project_id: 1,
        provider_id: 61,
        filters: JSON.stringify(policy.filters),
        trigger: JSON.stringify(policy.trigger),
        enabled: true,
        extra_attrs: JSON.stringify(policy.extra_attrs),
      },
    );
  });

  it("loads execution details, paginated tasks, structured logs, and stops a running execution", async () => {
    const execution: PreheatExecution = {
      id: 8101,
      status: "Running",
      trigger: "Manual",
      start_time: "2026-08-03T08:00:00Z",
      metrics: {
        task_count: 21,
        success_task_count: 2,
        error_task_count: 1,
        running_task_count: 18,
        stopped_task_count: 0,
      },
    };
    const task: PreheatTask = {
      id: 9101,
      execution_id: 8101,
      status: "Running",
      run_count: 1,
      start_time: "2026-08-03T08:00:01Z",
      extra_attrs: {
        artifact: "platform/gateway:v1",
        digest: "sha256:0123456789abcdef0123456789abcdef",
        kind: "IMAGE",
      },
    };
    const list = vi.spyOn(controlApi, "list").mockImplementation((operation) =>
      Promise.resolve(
        operation === "preheat-tasks"
          ? {
              items: [task],
              pagination: { page: 1, page_size: 100, total: 101 },
            }
          : {
              items: [execution],
              pagination: { page: 1, page_size: 100, total: 101 },
            },
      ),
    );
    const data = vi
      .spyOn(controlApi, "data")
      .mockImplementation((operation) =>
        Promise.resolve(
          operation === "preheat-task-log"
            ? "2026-08-03T08:00:01Z INFO preheat submitted\n2026-08-03T08:00:02Z ERROR retry queued"
            : execution,
        ),
      );
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onChanged = vi.fn();

    renderDialog(
      <PreheatExecutionsDialog
        project="platform"
        policy={policy}
        onClose={vi.fn()}
        onChanged={onChanged}
        onNotice={vi.fn()}
      />,
    );

    expect(await screen.findByText("#8101")).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "preheat-executions",
      {
        project: "platform",
        name: "release-images",
        page: 1,
        page_size: 100,
        sort: "-start_time",
      },
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        "preheat-executions",
        expect.objectContaining({ page: 2 }),
        expect.any(AbortSignal),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "查看预热执行任务" }));
    expect(await screen.findByText("platform/gateway:v1")).toBeVisible();
    expect(data).toHaveBeenCalledWith(
      "preheat-execution",
      { project: "platform", name: "release-images", id: 8101 },
      expect.any(AbortSignal),
    );
    expect(list).toHaveBeenCalledWith(
      "preheat-tasks",
      {
        project: "platform",
        name: "release-images",
        id: 8101,
        page: 1,
        page_size: 100,
        sort: "-creation_time",
      },
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        "preheat-tasks",
        expect.objectContaining({ page: 2 }),
        expect.any(AbortSignal),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "查看预热任务日志" }));
    expect(await screen.findByText("preheat submitted")).toBeVisible();
    expect(screen.getByText("retry queued")).toBeVisible();
    expect(data).toHaveBeenCalledWith(
      "preheat-task-log",
      {
        project: "platform",
        name: "release-images",
        id: 8101,
        task: 9101,
      },
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("button", { name: "停止执行" }));
    expect(screen.getByText(/已经完成的预热任务不会回滚/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "停止执行" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "preheat-execution",
      { project: "platform", name: "release-images", id: 8101 },
      "PATCH",
      { status: "Stopped" },
    );
  });
});
