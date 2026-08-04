import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { controlApi } from "../../app/api-client";
import { parseHashRoute } from "../../app/hash-router";
import { LocaleProvider } from "../../app/locale-context";
import { IconSprite } from "../../components/icons";
import { ReplicationPage } from "./replication-page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("replication page", () => {
  it("loads policy metadata and opens a typed create action", async () => {
    vi.spyOn(controlApi, "list").mockImplementation((operation) => {
      if (operation === "replication-policies") {
        return Promise.resolve({
          items: [{ id: 7, name: "release", enabled: true }],
          pagination: { page: 1, page_size: 100, total: 1 },
        });
      }
      if (operation === "registries") {
        return Promise.resolve({
          items: [{ id: 3, name: "production", type: "harbor" }],
          pagination: { page: 1, page_size: 100, total: 1 },
        });
      }
      return Promise.resolve({
        items: [],
        pagination: { page: 1, page_size: 100, total: 0 },
      });
    });
    const localInfo = {
      type: "harbor",
      supported_triggers: ["manual"],
      supported_resource_filters: [{ type: "name" }],
    };
    vi.spyOn(controlApi, "data").mockResolvedValue(localInfo);
    const onAction = vi.fn();
    const navigate = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <ReplicationPage
          route={parseHashRoute("#/replication")}
          demo
          refreshing={false}
          navigate={navigate}
          onRefresh={vi.fn()}
          onAction={onAction}
        />
      </LocaleProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "新建策略" }));
    await waitFor(() => expect(onAction).toHaveBeenCalledOnce());
    expect(onAction).toHaveBeenCalledWith({
      kind: "create",
      registries: [{ id: 3, name: "production", type: "harbor" }],
      labels: [],
      localInfo,
    });
    expect(
      screen.getByRole("cell", { name: "release策略 #7" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["策略", "方向", "远端仓库", "触发方式", "状态", ""]);
    fireEvent.click(screen.getByRole("button", { name: "排序" }));
    fireEvent.click(screen.getByRole("option", { name: "最近更新" }));
    expect(navigate).toHaveBeenCalledWith("replication?sort=-update_time");
    fireEvent.click(screen.getByRole("button", { name: "每页条数" }));
    fireEvent.click(screen.getByRole("option", { name: "20 条" }));
    expect(navigate).toHaveBeenCalledWith("replication?page_size=20");
  });
});
