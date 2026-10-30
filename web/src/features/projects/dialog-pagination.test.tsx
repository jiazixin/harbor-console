import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { DialogPagination } from "./dialog-pagination";

afterEach(cleanup);

describe("DialogPagination", () => {
  it("uses the same page jump control inside dialogs", async () => {
    const user = setupUser();
    const onPageChange = vi.fn();
    render(
      <TestProviders>
        <IconSprite />
        <DialogPagination
          pagination={{ page: 2, page_size: 10, total: 25 }}
          onPageChange={onPageChange}
        />
      </TestProviders>,
    );

    await user.click(screen.getByRole("button", { name: "跳转页码" }));
    const input = screen.getByRole("textbox", { name: "页码" });
    await replaceText(user, input, "999");
    await user.keyboard("{Enter}");
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
