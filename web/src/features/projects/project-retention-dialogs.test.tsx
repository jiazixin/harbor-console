import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import type {
  RetentionExecution,
  RetentionMetadata,
  RetentionPolicy,
  RetentionTask,
} from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { CreateRetentionPolicyDialog } from "./create-retention-policy-dialog";
import { DeleteRetentionRuleDialog } from "./delete-retention-rule-dialog";
import { RetentionExecutionDialog } from "./retention-execution-dialog";
import { RetentionRuleDialog } from "./retention-rule-dialog";
import { RetentionScheduleDialog } from "./retention-schedule-dialog";
import { RunRetentionDialog } from "./run-retention-dialog";
import { StopRetentionExecutionDialog } from "./stop-retention-execution-dialog";

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
    <TestProviders>
      <IconSprite />
      {content}
    </TestProviders>,
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
    const user = setupUser();
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

    await replaceText(
      user,
      screen.getByRole("spinbutton", { name: "数量或天数" }),
      "12",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "仓库匹配" }),
      " release/** ",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "Tag 匹配" }),
      " v* ",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: /^执行计划 Cron/ }),
      " 0 0 3 * * * ",
    );
    await user.click(screen.getByRole("button", { name: "创建策略" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "retentions",
      parameters: {},
      method: "POST",
      payload: {
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
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
  });

  it("updates a rule while preserving Harbor future fields", async () => {
    const user = setupUser();
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

    await replaceText(
      user,
      screen.getByRole("spinbutton", { name: "数量或天数" }),
      "15",
    );
    await user.click(screen.getByRole("checkbox", { name: /暂时停用规则/ }));
    await user.click(screen.getByRole("button", { name: "保存规则" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "retention",
      parameters: { id: 31 },
      method: "PUT",
      payload: {
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
          }) as unknown,
        ],
        trigger: { kind: "Schedule", settings: { cron: "0 0 2 * * *" } },
        scope: { level: "project", ref: 1 },
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("updates the policy schedule and algorithm with a minimal payload", async () => {
    const user = setupUser();
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

    await user.click(screen.getByRole("button", { name: "规则组合方式" }));
    await user.click(screen.getByRole("option", { name: "同时匹配全部规则" }));
    await replaceText(
      user,
      screen.getByRole("textbox", { name: /^执行计划 Cron/ }),
      "",
    );
    await user.click(screen.getByRole("button", { name: "保存计划" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "retention",
      parameters: { id: 31 },
      method: "PUT",
      payload: expect.objectContaining({
        algorithm: "and",
        trigger: { kind: "Schedule", settings: { cron: "" } },
        scope: { level: "project", ref: 1 },
      }) as unknown,
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("deletes and reindexes a rule without deleting the policy", async () => {
    const user = setupUser();
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
    await user.click(screen.getByRole("button", { name: "删除规则" }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledWith({
      operation: "retention",
      parameters: { id: 31 },
      method: "PUT",
      payload: expect.objectContaining({
        rules: [expect.objectContaining({ template: "always", priority: 1 })],
      }) as unknown,
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("starts and stops retention executions with exact action payloads", async () => {
    const user = setupUser();
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
    await user.click(screen.getByRole("button", { name: "开始演练" }));
    await waitFor(() => {
      expect(started).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenLastCalledWith({
      operation: "retention-executions",
      parameters: { id: 31 },
      method: "POST",
      payload: { dry_run: true },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });

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
    await user.click(screen.getByRole("button", { name: "停止执行" }));
    await waitFor(() => {
      expect(stopped).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenLastCalledWith({
      operation: "retention-execution",
      parameters: { id: 31, eid: 71 },
      method: "PATCH",
      payload: { action: "stop" },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("loads repository tasks and structured logs for an execution", async () => {
    const user = setupUser();
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
      expect.any(AbortSignal) as unknown,
    );
    await user.click(
      screen.getByRole("button", { name: "查看 Tag 保留任务日志" }),
    );
    expect(await screen.findByText("matched tags")).toBeVisible();
    expect(screen.getByText("WARN")).toBeVisible();
    expect(data).toHaveBeenCalledWith(
      "retention-task-log",
      { id: 31, eid: 71, tid: 171 },
      expect.any(AbortSignal) as unknown,
    );
  });
});
