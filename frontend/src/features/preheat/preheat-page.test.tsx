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
import { IconSprite } from "../../components/icons";
import { PreheatPage } from "./preheat-page";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("preheat page", () => {
  it("loads provider metadata and P2P instances with typed actions", async () => {
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
      <LocaleProvider>
        <IconSprite />
        <PreheatPage
          demo
          refreshing={false}
          onRefresh={vi.fn()}
          onAction={onAction}
          onNotice={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(await screen.findByText("Dragonfly")).toBeVisible();
    expect(screen.getByText("Kraken")).toBeVisible();
    expect(screen.getByText("dragonfly · v2")).toBeVisible();
    expect(screen.getByText("kraken · v1")).toBeVisible();
    expect(screen.getByText("dragonfly-shanghai")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "编辑实例" }));
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
      <LocaleProvider>
        <IconSprite />
        <PreheatPage
          demo={false}
          refreshing={false}
          onRefresh={vi.fn()}
          onAction={vi.fn()}
          onNotice={onNotice}
        />
      </LocaleProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "测试连接" }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith("preheat-instance-ping", {}, "POST", {
        id: 61,
      }),
    );
    expect(onNotice).toHaveBeenCalledWith("P2P Provider 连接正常");
  });
});
