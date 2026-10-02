import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../app/locale-context";
import { IconSprite } from "./icons";
import { Pagination } from "./data-table";

afterEach(cleanup);

describe("Pagination", () => {
  it("keeps page-size selection in the shared footer", () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(
      <LocaleProvider>
        <IconSprite />
        <Pagination
          pagination={{ page: 2, page_size: 20, total: 45 }}
          onPageChange={onPageChange}
          pageSizeOptions={[20, 50, 100]}
          onPageSizeChange={onPageSizeChange}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText("第 21-40 项，共 45 项")).toBeVisible();
    expect(screen.getByText("第 2 / 3 页")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "页码" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "每页条数" }));
    fireEvent.click(screen.getByRole("option", { name: "每页 50 条" }));
    expect(onPageSizeChange).toHaveBeenCalledWith(50);

    fireEvent.click(screen.getByRole("button", { name: "上一页" }));
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it("opens an inline page jump and clamps the requested page", () => {
    const onPageChange = vi.fn();
    render(
      <LocaleProvider>
        <IconSprite />
        <Pagination
          pagination={{ page: 2, page_size: 20, total: 45 }}
          onPageChange={onPageChange}
        />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "跳转页码" }));
    const input = screen.getByRole("textbox", { name: "页码" });
    expect(input).toHaveValue("");

    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: "跳转页码" }));
    const secondInput = screen.getByRole("textbox", { name: "页码" });
    fireEvent.change(secondInput, { target: { value: "0" } });
    fireEvent.keyDown(secondInput, { key: "Enter" });
    expect(onPageChange).toHaveBeenLastCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "跳转页码" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("textbox", { name: "页码" })).toBeNull();
    expect(screen.getByRole("button", { name: "跳转页码" })).toBeVisible();
  });
});
