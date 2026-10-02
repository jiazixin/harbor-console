import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../app/locale-context";
import { IconSprite } from "../../components/icons";
import { DialogPagination } from "./dialog-pagination";

afterEach(cleanup);

describe("DialogPagination", () => {
  it("uses the same page jump control inside dialogs", () => {
    const onPageChange = vi.fn();
    render(
      <LocaleProvider>
        <IconSprite />
        <DialogPagination
          pagination={{ page: 2, page_size: 10, total: 25 }}
          onPageChange={onPageChange}
        />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "跳转页码" }));
    const input = screen.getByRole("textbox", { name: "页码" });
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
