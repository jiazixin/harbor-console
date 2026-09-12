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
    expect(screen.getByRole("columnheader", { name: /策略/ })).toHaveAttribute(
      "aria-sort",
      "none",
    );
    fireEvent.click(screen.getByRole("button", { name: "按策略升序排序" }));
    expect(navigate).toHaveBeenCalledWith("replication?sort=name");
    fireEvent.click(screen.getByRole("button", { name: "每页条数" }));
    fireEvent.click(screen.getByRole("option", { name: "每页 20 条" }));
    expect(navigate).toHaveBeenCalledWith("replication?page_size=20");
  });

  it("translates execution statuses and exposes sortable execution headers", async () => {
    vi.spyOn(controlApi, "list").mockImplementation((operation) => {
      if (operation === "replication-policies") {
        return Promise.resolve({
          items: [{ id: 7, name: "release", enabled: true }],
          pagination: { page: 1, page_size: 100, total: 1 },
        });
      }
      if (operation === "replication-executions") {
        return Promise.resolve({
          items: [
            {
              id: 9,
              policy_id: 7,
              trigger: "manual",
              status: "InProgress",
              total: 3,
              start_time: "2026-08-04T01:00:00Z",
            },
          ],
          pagination: { page: 1, page_size: 100, total: 1 },
        });
      }
      return Promise.resolve({
        items: [],
        pagination: { page: 1, page_size: 100, total: 0 },
      });
    });
    vi.spyOn(controlApi, "data").mockResolvedValue(undefined);
    const navigate = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <ReplicationPage
          route={parseHashRoute("#/replication?tab=executions")}
          demo
          refreshing={false}
          navigate={navigate}
          onRefresh={vi.fn()}
          onAction={vi.fn()}
        />
      </LocaleProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "状态" }));
    expect(screen.getByRole("option", { name: "进行中" })).toBeVisible();
    expect(screen.getByRole("option", { name: "成功" })).toBeVisible();
    expect(screen.getByRole("option", { name: "失败" })).toBeVisible();
    expect(screen.getByRole("option", { name: "已停止" })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("listbox", { name: "状态" }), {
      key: "Escape",
    });

    fireEvent.click(screen.getByRole("button", { name: "按任务统计降序排序" }));
    expect(navigate).toHaveBeenCalledWith(
      "replication?tab=executions&sort=-tasks",
    );
    expect(
      screen.getByRole("button", { name: "按耗时降序排序" }),
    ).toBeVisible();
  });

  it("sorts the complete execution result before slicing the requested page", async () => {
    const executionItems = Array.from({ length: 120 }, (_, index) => ({
      id: index + 1,
      policy_id: 7,
      trigger: "manual",
      status: "Succeed",
      total: index + 1,
      start_time: `2026-08-04T00:${String(index % 60).padStart(2, "0")}:00Z`,
    }));
    const list = vi
      .spyOn(controlApi, "list")
      .mockImplementation((operation, parameters) => {
        if (operation === "replication-policies") {
          return Promise.resolve({
            items: [{ id: 7, name: "release", enabled: true }],
            pagination: { page: 1, page_size: 100, total: 1 },
          });
        }
        if (operation === "replication-executions") {
          const page = Number(parameters?.page ?? 1);
          const start = (page - 1) * 100;
          return Promise.resolve({
            items: executionItems.slice(start, start + 100),
            pagination: { page, page_size: 100, total: executionItems.length },
          });
        }
        return Promise.resolve({
          items: [],
          pagination: { page: 1, page_size: 100, total: 0 },
        });
      });
    vi.spyOn(controlApi, "data").mockResolvedValue(undefined);

    render(
      <LocaleProvider>
        <IconSprite />
        <ReplicationPage
          route={parseHashRoute(
            "#/replication?tab=executions&page=2&sort=-tasks",
          )}
          demo
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn()}
          onAction={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(await screen.findByRole("cell", { name: "#70" })).toBeVisible();
    expect(screen.queryByRole("cell", { name: "#120" })).toBeNull();
    expect(list).toHaveBeenCalledWith(
      "replication-executions",
      { page: 2, page_size: 100 },
      expect.any(AbortSignal),
    );
    expect(screen.getByText("第 51-100 项，共 120 项")).toBeVisible();
  });
});
