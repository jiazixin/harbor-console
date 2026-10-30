import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import type { ReplicationAdapterInfo } from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { ReplicationExecutionDialog } from "./replication-execution-dialog";
import { ReplicationPolicyDialog } from "./replication-policy-dialog";

function renderDialog(node: React.ReactNode) {
  return render(
    <TestProviders>
      <IconSprite />
      {node}
    </TestProviders>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("replication dialogs", () => {
  it("translates captured demo policy descriptions in the English editor", () => {
    window.localStorage.setItem("harbor-console-language", "en-US");
    const capability: ReplicationAdapterInfo = {
      type: "harbor",
      supported_resource_filters: [],
      supported_triggers: ["scheduled"],
      supported_copy_by_chunk: true,
    };
    vi.spyOn(controlApi, "data").mockResolvedValue(capability);

    renderDialog(
      <ReplicationPolicyDialog
        policy={{
          id: 1,
          name: "production-mirror",
          description: "生产发布镜像定时同步",
          dest_registry: { id: 3 },
          trigger: {
            type: "scheduled",
            trigger_settings: { cron: "0 0 */2 * * *" },
          },
        }}
        registries={[{ id: 3, name: "production", type: "harbor" }]}
        labels={[]}
        localInfo={capability}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue(
      "Scheduled production release image synchronization",
    );
  });

  it("creates a policy with only Harbor v2.15 replication fields", async () => {
    const user = setupUser();
    const capability: ReplicationAdapterInfo = {
      type: "harbor",
      supported_resource_filters: [
        { type: "name", values: [] },
        { type: "tag", values: [] },
        { type: "resource", values: ["image"] },
      ],
      supported_triggers: ["manual", "scheduled", "event_based"],
      supported_copy_by_chunk: true,
    };
    vi.spyOn(controlApi, "data").mockResolvedValue(capability);
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const saved = vi.fn();
    renderDialog(
      <ReplicationPolicyDialog
        registries={[{ id: 3, name: "production", type: "harbor" }]}
        labels={[]}
        localInfo={capability}
        onClose={vi.fn()}
        onSaved={saved}
      />,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "策略名称" }),
      "release",
    );
    await replaceText(
      user,
      screen.getByPlaceholderText("例如 platform/**"),
      "platform/**",
    );
    const submit = screen.getByRole("button", { name: "创建策略" });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledOnce();
    });
    expect(mutate).toHaveBeenCalledWith({
      operation: "replication-policies",
      parameters: {},
      method: "POST",
      payload: {
        name: "release",
        description: "",
        src_registry: null,
        dest_registry: { id: 3 },
        dest_namespace: "",
        dest_namespace_replace_count: 1,
        trigger: { type: "manual", trigger_settings: {} },
        filters: [{ type: "name", value: "platform/**" }],
        enabled: true,
        override: true,
        replicate_deletion: false,
        speed: -1,
        single_active_replication: false,
        copy_by_chunk: false,
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
    expect(saved).toHaveBeenCalledOnce();
  });

  it("treats an omitted enabled field from Harbor as disabled", () => {
    const capability: ReplicationAdapterInfo = {
      type: "harbor",
      supported_resource_filters: [],
      supported_triggers: ["manual"],
      supported_copy_by_chunk: false,
    };
    vi.spyOn(controlApi, "data").mockResolvedValue(capability);

    renderDialog(
      <ReplicationPolicyDialog
        policy={{
          id: 1,
          name: "disabled-policy",
          speed: 0,
          dest_registry: { id: 3 },
          trigger: { type: "manual", trigger_settings: {} },
        }}
        registries={[{ id: 3, name: "production", type: "harbor" }]}
        labels={[]}
        localInfo={capability}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("checkbox", {
        name: "启用策略允许策略按配置的触发方式运行",
      }),
    ).not.toBeChecked();
    expect(screen.getByRole("spinbutton")).toHaveValue(-1);
  });

  it("aborts the previous replication log refresh and ignores stale output", async () => {
    const user = setupUser();
    const pendingLogs: {
      signal: AbortSignal;
      resolve: (value: string) => void;
    }[] = [];
    vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [
        {
          id: 9,
          execution_id: 4,
          status: "Succeed",
          resource_type: "image",
        },
      ],
      pagination: { page: 1, page_size: 100, total: 1 },
    });
    vi.spyOn(controlApi, "data").mockImplementation(
      (operation, _parameters, signal) => {
        if (operation === "replication-execution") {
          return Promise.resolve({
            id: 4,
            status: "Succeed",
            trigger: "manual",
            total: 1,
          });
        }
        return new Promise<string>((resolve, reject) => {
          if (!signal) throw new Error("log request must be cancellable");
          pendingLogs.push({ signal, resolve });
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      },
    );

    renderDialog(
      <ReplicationExecutionDialog
        execution={{ id: 4 }}
        onClose={vi.fn()}
        onChanged={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "查看任务 9 日志" }),
    );
    await waitFor(() => {
      expect(pendingLogs).toHaveLength(1);
    });
    await user.click(screen.getByRole("button", { name: "刷新复制任务日志" }));
    await waitFor(() => {
      expect(pendingLogs).toHaveLength(2);
    });
    expect(pendingLogs[0]?.signal.aborted).toBe(true);
    pendingLogs[1]?.resolve("2026-08-03T10:00:00Z INFO current response");
    await screen.findByText("current response");
  });
});
