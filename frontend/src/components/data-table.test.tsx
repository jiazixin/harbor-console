import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../app/locale-context";
import { IconSprite } from "./icons";
import { Pagination } from "./data-table";

afterEach(cleanup);

describe("Pagination", () => {
  it("renders the legacy static pagination contract", () => {
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

    expect(screen.getByText("第 21-40 项，共 45 项")).toBeVisible();
    expect(screen.getByText("第 2 / 3 页")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "页码" })).toBeNull();
    expect(screen.queryByRole("button", { name: "每页条数" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "上一页" }));
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });
});
