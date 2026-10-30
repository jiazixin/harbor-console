import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TestProviders } from "../test/test-providers";
import { replaceText, setupUser } from "../test/user";
import { IconSprite } from "./icon-sprite";
import { Pagination } from "./pagination";

afterEach(cleanup);

describe("Pagination", () => {
  it("keeps page-size selection in the shared footer", async () => {
    const user = setupUser();
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(
      <TestProviders>
        <IconSprite />
        <Pagination
          pagination={{ page: 2, page_size: 20, total: 45 }}
          onPageChange={onPageChange}
          pageSizeOptions={[20, 50, 100]}
          onPageSizeChange={onPageSizeChange}
        />
      </TestProviders>,
    );

    expect(screen.getByText("第 21-40 项，共 45 项")).toBeVisible();
    expect(screen.getByText("第 2 / 3 页")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "页码" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "每页条数" }));
    await user.click(screen.getByRole("option", { name: "每页 50 条" }));
    expect(onPageSizeChange).toHaveBeenCalledWith(50);

    await user.click(screen.getByRole("button", { name: "上一页" }));
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it("opens an inline page jump and clamps the requested page", async () => {
    const user = setupUser();
    const onPageChange = vi.fn();
    render(
      <TestProviders>
        <IconSprite />
        <Pagination
          pagination={{ page: 2, page_size: 20, total: 45 }}
          onPageChange={onPageChange}
        />
      </TestProviders>,
    );

    await user.click(screen.getByRole("button", { name: "跳转页码" }));
    const input = screen.getByRole("textbox", { name: "页码" });
    expect(input).toHaveValue("");

    await replaceText(user, input, "999");
    await user.keyboard("{Enter}");
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole("button", { name: "跳转页码" }));
    const secondInput = screen.getByRole("textbox", { name: "页码" });
    await replaceText(user, secondInput, "0");
    await user.keyboard("{Enter}");
    expect(onPageChange).toHaveBeenLastCalledWith(1);

    await user.click(screen.getByRole("button", { name: "跳转页码" }));
    await user.click(document.body);
    expect(screen.queryByRole("textbox", { name: "页码" })).toBeNull();
    expect(screen.getByRole("button", { name: "跳转页码" })).toBeVisible();
  });
});
