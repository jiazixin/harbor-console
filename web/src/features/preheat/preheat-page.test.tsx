import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { setupUser } from "../../test/user";
import { PreheatPage } from "./preheat-page";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("preheat page", () => {
  it("loads provider metadata and P2P instances with typed actions", async () => {
    const user = setupUser();
    vi.spyOn(controlApi, "data").mockResolvedValue([
      { id: "dragonfly", name: "Dragonfly", version: "v2" },
      { id: "kraken", name: "Kraken", version: "v1" },
    ]);
    vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [
        {
          id: 61,
          name: "dragonfly-shanghai",
          description: "上海生产集群预热服务",
          vendor: "dragonfly",
          endpoint: "https://dragonfly.demo.local",
          auth_mode: "BASIC",
          status: "Healthy",
          enabled: true,
          default: true,
        },
      ],
      pagination: { page: 1, page_size: 100, total: 1 },
    });
    const onAction = vi.fn();
    render(
      <TestProviders>
        <IconSprite />
        <PreheatPage
          demo
          refreshing={false}
          onRefresh={vi.fn()}
          onAction={onAction}
          onNotice={vi.fn()}
        />
      </TestProviders>,
    );

    expect(await screen.findByText("Dragonfly")).toBeVisible();
    expect(screen.getByText("Kraken")).toBeVisible();
    expect(screen.queryByText("dragonfly · v2")).toBeNull();
    expect(screen.queryByText("kraken · v1")).toBeNull();
    expect(screen.queryByText("v2")).toBeNull();
    expect(screen.queryByText("v1")).toBeNull();
    expect(screen.getByText("dragonfly-shanghai")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "编辑实例" }));
    expect(onAction).toHaveBeenCalledWith({
      kind: "edit",
      instance: {
        id: 61,
        name: "dragonfly-shanghai",
        description: "上海生产集群预热服务",
        vendor: "dragonfly",
        endpoint: "https://dragonfly.demo.local",
        auth_mode: "BASIC",
        status: "Healthy",
        enabled: true,
        default: true,
      },
      providers: [
        { id: "dragonfly", name: "Dragonfly", version: "v2" },
        { id: "kraken", name: "Kraken", version: "v1" },
      ],
    });
  });

  it("pings an existing instance by ID", async () => {
    const user = setupUser();
    vi.spyOn(controlApi, "data").mockResolvedValue([
      { id: "dragonfly", name: "Dragonfly" },
    ]);
    vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [
        {
          id: 61,
          name: "dragonfly",
          vendor: "dragonfly",
          endpoint: "https://dragonfly.example.com",
        },
      ],
      pagination: { page: 1, page_size: 100, total: 1 },
    });
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const onNotice = vi.fn();
    render(
      <TestProviders>
        <IconSprite />
        <PreheatPage
          demo={false}
          refreshing={false}
          onRefresh={vi.fn()}
          onAction={vi.fn()}
          onNotice={onNotice}
        />
      </TestProviders>,
    );

    await user.click(await screen.findByRole("button", { name: "测试连接" }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "preheat-instance-ping",
        parameters: {},
        method: "POST",
        payload: {
          id: 61,
        },
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: expect.any(String) as unknown,
      });
    });
    expect(onNotice).toHaveBeenCalledWith("P2P Provider 连接正常");
  });
});
