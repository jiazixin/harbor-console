import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { DeletePreheatInstanceDialog } from "./delete-preheat-instance-dialog";
import { PreheatInstanceDialog } from "./preheat-instance-dialog";

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

describe("preheat instance dialogs", () => {
  it("translates captured demo instance descriptions in the English editor", () => {
    window.localStorage.setItem("harbor-console-language", "en-US");
    renderDialog(
      <PreheatInstanceDialog
        instance={{
          id: 61,
          name: "dragonfly-prod",
          description: "上海生产集群预热服务",
          vendor: "dragonfly",
          endpoint: "https://dragonfly.example.com",
        }}
        providers={[{ id: "dragonfly", name: "Dragonfly" }]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue(
      "Shanghai production cluster preheat service",
    );
  });

  it("creates a production P2P instance payload without response fields", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const onSaved = vi.fn();
    renderDialog(
      <PreheatInstanceDialog
        providers={[{ id: "dragonfly", name: "Dragonfly" }]}
        onClose={vi.fn()}
        onSaved={onSaved}
        onNotice={vi.fn()}
      />,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "实例名称" }),
      "dragonfly-prod",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "服务地址" }),
      "https://dragonfly.example.com",
    );
    await user.click(screen.getByRole("button", { name: "创建实例" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(mutate).toHaveBeenCalledWith({
      operation: "preheat-instances",
      parameters: {},
      method: "POST",
      payload: {
        name: "dragonfly-prod",
        description: "",
        vendor: "dragonfly",
        endpoint: "https://dragonfly.example.com",
        auth_mode: "NONE",
        enabled: true,
        insecure: false,
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
  });

  it("tests the current BASIC draft and keeps blank edit credentials explicit", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const onNotice = vi.fn();
    renderDialog(
      <PreheatInstanceDialog
        instance={{
          id: 61,
          name: "dragonfly-prod",
          vendor: "dragonfly",
          endpoint: "https://dragonfly.example.com",
          auth_mode: "BASIC",
          enabled: true,
        }}
        providers={[{ id: "dragonfly", name: "Dragonfly" }]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onNotice={onNotice}
      />,
    );

    await user.click(screen.getByRole("button", { name: "测试连接" }));
    await waitFor(() => {
      expect(onNotice).toHaveBeenCalled();
    });
    expect(mutate).toHaveBeenCalledWith({
      operation: "preheat-instance-ping",
      parameters: {},
      method: "POST",
      payload: {
        id: 61,
        name: "dragonfly-prod",
        description: "",
        vendor: "dragonfly",
        endpoint: "https://dragonfly.example.com",
        auth_mode: "BASIC",
        auth_info: {},
        enabled: true,
        insecure: false,
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
  });

  it("deletes an instance by its stable Harbor name", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    renderDialog(
      <DeletePreheatInstanceDialog
        instance={{
          id: 61,
          name: "dragonfly-prod",
          vendor: "dragonfly",
          endpoint: "https://dragonfly.example.com",
        }}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    await user.click(screen.getByRole("button", { name: "删除实例" }));
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(mutate).toHaveBeenCalledWith({
      operation: "preheat-instance",
      parameters: { name: "dragonfly-prod" },
      method: "DELETE",
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });
});
