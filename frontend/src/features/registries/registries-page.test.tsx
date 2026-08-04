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
import { RegistriesPage } from "./registries-page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("registries page", () => {
  it("loads registry capabilities and renders the legacy name-ordered cards", async () => {
    const list = vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [
        { id: 2, name: "edge", type: "docker-hub", status: "healthy" },
        { id: 1, name: "prod", type: "harbor", status: "healthy" },
      ],
      pagination: { page: 1, page_size: 100, total: 2 },
    });
    const data = vi
      .spyOn(controlApi, "data")
      .mockImplementation((operation) =>
        Promise.resolve(operation === "registry-adapters" ? ["harbor"] : {}),
      );
    render(
      <LocaleProvider>
        <IconSprite />
        <RegistriesPage
          demo
          refreshing={false}
          onRefresh={vi.fn()}
          onAction={vi.fn()}
          onNotice={vi.fn()}
        />
      </LocaleProvider>,
    );

    await waitFor(() => expect(list).toHaveBeenCalledOnce());
    expect(list).toHaveBeenCalledWith(
      "registries",
      { page: 1, page_size: 100, sort: "name" },
      expect.any(AbortSignal),
    );
    const cards = await screen.findAllByRole("article");
    expect(cards[0]).toHaveTextContent("edge");
    expect(cards[0]).toHaveTextContent("#2");
    expect(cards[0]).toHaveTextContent("正常");
    expect(cards[1]).toHaveTextContent("prod");
    expect(cards[1]).toHaveTextContent("#1");
    expect(data).toHaveBeenCalledWith(
      "registry-adapters",
      {},
      expect.any(AbortSignal),
    );
    expect(data).toHaveBeenCalledWith(
      "registry-adapter-infos",
      {},
      expect.any(AbortSignal),
    );
  });

  it("opens a typed create action with loaded adapter metadata", async () => {
    vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [],
      pagination: { page: 1, page_size: 100, total: 0 },
    });
    vi.spyOn(controlApi, "data").mockImplementation((operation) =>
      Promise.resolve(
        operation === "registry-adapters"
          ? ["harbor"]
          : { harbor: { endpoint_pattern: { endpoints: [] } } },
      ),
    );
    const onAction = vi.fn();
    render(
      <LocaleProvider>
        <IconSprite />
        <RegistriesPage
          demo
          refreshing={false}
          onRefresh={vi.fn()}
          onAction={onAction}
          onNotice={vi.fn()}
        />
      </LocaleProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "新建连接" }));
    expect(onAction).toHaveBeenCalledWith({
      kind: "create",
      adapters: ["harbor"],
      adapterInfos: { harbor: { endpoint_pattern: { endpoints: [] } } },
    });
  });
});
