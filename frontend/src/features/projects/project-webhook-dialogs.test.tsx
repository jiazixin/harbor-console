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
  ProjectWebhook,
  WebhookEventMetadata,
  WebhookExecution,
  WebhookTask,
} from "../../app/models";
import { IconSprite } from "../../components/icons";
import {
  DeleteProjectWebhookDialog,
  ProjectWebhookDialog,
  WebhookHistoryDialog,
} from "./project-webhook-dialogs";

const metadata: WebhookEventMetadata = {
  event_type: [
    "PUSH_ARTIFACT",
    "PULL_ARTIFACT",
    "DELETE_ARTIFACT",
    "SCANNING_COMPLETED",
  ],
  payload_formats: [
    { notify_type: "http", formats: ["Default", "CloudEvents"] },
  ],
};

const webhook: ProjectWebhook = {
  id: 41,
  name: "deploy-events",
  description: "Push release event",
  enabled: true,
  event_types: ["PUSH_ARTIFACT"],
  targets: [
    {
      type: "http",
      address: "https://hooks.demo.local/harbor",
      auth_header: "Bearer old-token",
      payload_format: "Default",
      skip_cert_verify: false,
    },
  ],
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

describe("project webhook dialogs", () => {
  it("creates a webhook with the exact Harbor payload", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onSaved = vi.fn();

    renderDialog(
      <ProjectWebhookDialog
        project="platform"
        metadata={metadata}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "名称" }), {
      target: { value: " release-events " },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "目标地址" }), {
      target: { value: " https://hooks.example.com/releases " },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Authorization 请求头" }),
      { target: { value: "Bearer release-token" } },
    );
    fireEvent.change(screen.getByRole("textbox", { name: "描述" }), {
      target: { value: " Release automation " },
    });
    fireEvent.click(screen.getByRole("button", { name: "负载格式" }));
    fireEvent.click(screen.getByRole("option", { name: "CloudEvents" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /启用 Webhook/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /跳过 TLS 验证/ }));
    fireEvent.click(screen.getByRole("button", { name: "创建 Webhook" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "webhooks",
      { project: "platform" },
      "POST",
      {
        name: "release-events",
        description: "Release automation",
        enabled: false,
        event_types: ["PUSH_ARTIFACT", "SCANNING_COMPLETED"],
        targets: [
          {
            type: "http",
            address: "https://hooks.example.com/releases",
            auth_header: "Bearer release-token",
            skip_cert_verify: true,
            payload_format: "CloudEvents",
          },
        ],
      },
    );
  });

  it("rejects an empty event selection and never submits hidden defaults", async () => {
    const mutation = vi.spyOn(controlApi, "mutate");

    renderDialog(
      <ProjectWebhookDialog
        project="platform"
        metadata={{ event_type: ["QUOTA_EXCEED"] }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "名称" }), {
      target: { value: "quota-events" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "目标地址" }), {
      target: { value: "https://hooks.example.com/quota" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建 Webhook" }));

    expect(await screen.findByText("请至少选择一种事件类型")).toBeVisible();
    expect(mutation).not.toHaveBeenCalled();
  });

  it("updates only the editable webhook policy fields", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onSaved = vi.fn();

    renderDialog(
      <ProjectWebhookDialog
        project="platform"
        webhook={webhook}
        metadata={metadata}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "描述" }), {
      target: { value: "Updated release event" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /扫描完成.*SCANNING_COMPLETED/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "保存 Webhook" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "webhook",
      { project: "platform", id: 41 },
      "PUT",
      {
        name: "deploy-events",
        description: "Updated release event",
        enabled: true,
        event_types: ["PUSH_ARTIFACT", "SCANNING_COMPLETED"],
        targets: [
          {
            type: "http",
            address: "https://hooks.demo.local/harbor",
            auth_header: "Bearer old-token",
            skip_cert_verify: false,
            payload_format: "Default",
          },
        ],
      },
    );
  });

  it("loads filtered execution history, tasks, and structured task logs", async () => {
    const execution: WebhookExecution = {
      id: 77,
      status: "Success",
      trigger: "event_based",
      start_time: "2026-08-03T08:00:00Z",
      end_time: "2026-08-03T08:00:03Z",
      metrics: { task_count: 1, success_task_count: 1 },
      extra_attrs: { event_type: "PUSH_ARTIFACT" },
    };
    const task: WebhookTask = {
      id: 88,
      status: "Success",
      run_count: 1,
      start_time: "2026-08-03T08:00:01Z",
      extra_attrs: {
        event_type: "PUSH_ARTIFACT",
        resource: "platform/api:v1",
        destination: "https://hooks.demo.local/harbor",
      },
    };
    const list = vi.spyOn(controlApi, "list").mockImplementation((operation) =>
      Promise.resolve(
        operation === "webhook-tasks"
          ? {
              items: [task],
              pagination: { page: 1, page_size: 20, total: 1 },
            }
          : {
              items: [execution],
              pagination: { page: 1, page_size: 20, total: 1 },
            },
      ),
    );
    const data = vi
      .spyOn(controlApi, "data")
      .mockResolvedValue(
        "2026-08-03T08:00:01Z INFO webhook delivered\n2026-08-03T08:00:02Z ERROR retry skipped",
      );

    renderDialog(
      <WebhookHistoryDialog
        project="platform"
        webhook={webhook}
        onClose={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    expect(await screen.findByText("PUSH_ARTIFACT")).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "webhook-executions",
      {
        project: "platform",
        id: 41,
        page: 1,
        page_size: 20,
        sort: "-start_time",
        q: "",
      },
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("button", { name: "状态" }));
    fireEvent.click(screen.getByRole("option", { name: "异常" }));
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        "webhook-executions",
        expect.objectContaining({ q: "status=Error" }),
        expect.any(AbortSignal),
      ),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "查看 Webhook 执行任务" }),
    );
    expect(await screen.findByText("platform/api:v1")).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "webhook-tasks",
      {
        project: "platform",
        id: 41,
        execution: 77,
        page: 1,
        page_size: 20,
        sort: "-start_time",
      },
      expect.any(AbortSignal),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "查看 Webhook 任务日志" }),
    );
    expect(await screen.findByText("webhook delivered")).toBeVisible();
    expect(screen.getByText("retry skipped")).toBeVisible();
    expect(data).toHaveBeenCalledWith(
      "webhook-task-log",
      {
        project: "platform",
        id: 41,
        execution: 77,
        task: 88,
      },
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole("button", { name: "UTC" }));
    expect(screen.getByRole("button", { name: "UTC" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("deletes the selected webhook policy", async () => {
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const onDeleted = vi.fn();

    renderDialog(
      <DeleteProjectWebhookDialog
        project="platform"
        webhook={webhook}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    expect(
      screen.getByText("Webhook deploy-events 将停止发送事件。"),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "删除 Webhook" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(mutation).toHaveBeenCalledWith(
      "webhook",
      { project: "platform", id: 41 },
      "DELETE",
    );
  });
});
