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
  RetentionExecution,
  RetentionMetadata,
  RetentionPolicy,
  RetentionTask,
} from "../../app/models";
import { IconSprite } from "../../components/icons";
import {
  CreateRetentionPolicyDialog,
  DeleteRetentionRuleDialog,
  RetentionExecutionDialog,
  RetentionRuleDialog,
  RetentionScheduleDialog,
  RunRetentionDialog,
  StopRetentionExecutionDialog,
} from "./project-retention-dialogs";

const metadata: RetentionMetadata = {
  templates: [
    {
      rule_template: "latestPushedK",
      display_text: "保留最近推送的制品",
    },
    { rule_template: "always", display_text: "永久保留全部匹配制品" },
  ],
  scope_selectors: [
    { kind: "doublestar", decorations: ["repoMatches", "repoExcludes"] },
  ],
  tag_selectors: [{ kind: "doublestar", decorations: ["matches", "excludes"] }],
};

const policy: RetentionPolicy = {
  id: 31,
  algorithm: "or",
  rules: [
    {
      id: 1,
      priority: 1,
      disabled: false,
      action: "retain",
      template: "latestPushedK",
      params: { latestPushedK: 10 },
      future_field: "preserve-me",
      tag_selectors: [
        {
          kind: "doublestar",
          decoration: "excludes",
          pattern: "scratch-*",
          extras: '{"untagged":true,"future_extra":"preserve-me"}',
        },
      ],
      scope_selectors: {
        repository: [
          {
            kind: "doublestar",
            decoration: "repoExcludes",
            pattern: "sandbox/**",
          },
        ],
      },
    },
  ],
  trigger: { kind: "Schedule", settings: { cron: "0 0 2 * * *" } },
  scope: { level: "project", ref: 1 },
};

const execution: RetentionExecution = {
  id: 71,
  policy_id: 31,
  status: "Succeed",
  dry_run: true,
  start_time: "2026-07-27T02:00:00Z",
  end_time: "2026-07-27T02:00:18Z",
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

describe("project retention dialogs", () => {
  it("translates the dynamic policy subtitle in English", () => {
    window.localStorage.setItem("harbor-console-language", "en-US");
    renderDialog(
      <RetentionScheduleDialog
        projectId={1}
        policy={policy}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByText("Policy #31")).toBeInTheDocument();
  });

  it("creates a policy with one normalized rule and no response fields", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onSaved = vi.fn();
    renderDialog(
      <CreateRetentionPolicyDialog
        project="platform"
        projectId={1}
        metadata={metadata}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "数量或天数" }), {
      target: { value: "12" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "仓库匹配" }), {
      target: { value: " release/** " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Tag 匹配" }), {
      target: { value: " v* " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /^执行计划 Cron/ }), {
      target: { value: " 0 0 3 * * * " },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建策略" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith("retentions", {}, "POST", {
      algorithm: "or",
      rules: [
        {
          priority: 1,
          disabled: false,
          action: "retain",
          template: "latestPushedK",
          params: { latestPushedK: 12 },
          tag_selectors: [
            {
              kind: "doublestar",
              decoration: "matches",
              pattern: "v*",
            },
          ],
          scope_selectors: {
            repository: [
              {
                kind: "doublestar",
                decoration: "repoMatches",
                pattern: "release/**",
              },
            ],
          },
        },
      ],
      trigger: { kind: "Schedule", settings: { cron: "0 0 3 * * *" } },
      scope: { level: "project", ref: 1 },
    });
  });

  it("updates a rule while preserving Harbor future fields", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onSaved = vi.fn();
    renderDialog(
      <RetentionRuleDialog
        projectId={1}
        policy={policy}
        metadata={metadata}
        ruleIndex={0}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "数量或天数" }), {
      target: { value: "15" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /暂时停用规则/ }));
    fireEvent.click(screen.getByRole("button", { name: "保存规则" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith("retention", { id: 31 }, "PUT", {
      algorithm: "or",
      rules: [
        expect.objectContaining({
          id: 1,
          priority: 1,
          disabled: true,
          future_field: "preserve-me",
          params: { latestPushedK: 15 },
          tag_selectors: [
            expect.objectContaining({
              extras: '{"untagged":true,"future_extra":"preserve-me"}',
            }),
          ],
        }),
      ],
      trigger: { kind: "Schedule", settings: { cron: "0 0 2 * * *" } },
      scope: { level: "project", ref: 1 },
    });
  });

  it("updates the policy schedule and algorithm with a minimal payload", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onSaved = vi.fn();
    renderDialog(
      <RetentionScheduleDialog
        projectId={1}
        policy={policy}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "规则组合方式" }));
    fireEvent.click(screen.getByRole("option", { name: "同时匹配全部规则" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^执行计划 Cron/ }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存计划" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "retention",
      { id: 31 },
      "PUT",
      expect.objectContaining({
        algorithm: "and",
        trigger: { kind: "Schedule", settings: { cron: "" } },
        scope: { level: "project", ref: 1 },
      }),
    );
  });

  it("deletes and reindexes a rule without deleting the policy", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const twoRulePolicy: RetentionPolicy = {
      ...policy,
      rules: [
        ...(policy.rules ?? []),
        {
          priority: 2,
          action: "retain",
          template: "always",
          params: {},
          tag_selectors: [
            { kind: "doublestar", decoration: "matches", pattern: "**" },
          ],
          scope_selectors: {
            repository: [
              {
                kind: "doublestar",
                decoration: "repoMatches",
                pattern: "**",
              },
            ],
          },
        },
      ],
    };
    renderDialog(
      <DeleteRetentionRuleDialog
        projectId={1}
        policy={twoRulePolicy}
        ruleIndex={0}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除规则" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "retention",
      { id: 31 },
      "PUT",
      expect.objectContaining({
        rules: [expect.objectContaining({ template: "always", priority: 1 })],
      }),
    );
  });

  it("starts and stops retention executions with exact action payloads", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const started = vi.fn();
    const first = renderDialog(
      <RunRetentionDialog
        policy={policy}
        dryRun={true}
        onClose={vi.fn()}
        onStarted={started}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "开始演练" }));
    await waitFor(() => expect(started).toHaveBeenCalled());
    expect(mutation).toHaveBeenLastCalledWith(
      "retention-executions",
      { id: 31 },
      "POST",
      { dry_run: true },
    );

    first.unmount();
    const stopped = vi.fn();
    renderDialog(
      <StopRetentionExecutionDialog
        policy={policy}
        execution={{ ...execution, status: "Running" }}
        onClose={vi.fn()}
        onStopped={stopped}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "停止执行" }));
    await waitFor(() => expect(stopped).toHaveBeenCalled());
    expect(mutation).toHaveBeenLastCalledWith(
      "retention-execution",
      { id: 31, eid: 71 },
      "PATCH",
      { action: "stop" },
    );
  });

  it("loads repository tasks and structured logs for an execution", async () => {
    const task: RetentionTask = {
      id: 171,
      execution_id: 71,
      repository: "platform/gateway",
      status: "Succeed",
      status_code: 200,
      total: 28,
      retained: 10,
      start_time: "2026-07-27T02:00:01Z",
      end_time: "2026-07-27T02:00:09Z",
    };
    const list = vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [task],
      pagination: { page: 1, page_size: 20, total: 1 },
    });
    const data = vi
      .spyOn(controlApi, "data")
      .mockResolvedValue(
        "2026-07-27T02:00:01Z [INFO] matched tags\n2026-07-27T02:00:09Z [WARN] dry run",
      );
    renderDialog(
      <RetentionExecutionDialog
        project="platform"
        policy={policy}
        execution={execution}
        onClose={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    expect(await screen.findByText("platform/gateway")).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "retention-tasks",
      { id: 31, eid: 71, page: 1, page_size: 20 },
      expect.any(AbortSignal),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "查看 Tag 保留任务日志" }),
    );
    expect(await screen.findByText("matched tags")).toBeVisible();
    expect(screen.getByText("WARN")).toBeVisible();
    expect(data).toHaveBeenCalledWith(
      "retention-task-log",
      { id: 31, eid: 71, tid: 171 },
      expect.any(AbortSignal),
    );
  });
});
