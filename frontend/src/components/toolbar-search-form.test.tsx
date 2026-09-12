import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../app/locale-context";
import { IconSprite } from "./icons";
import { ToolbarSearchForm } from "./toolbar-search-form";

describe("ToolbarSearchForm", () => {
  it("submits the current draft across a stale parent rerender", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const view = render(
      <LocaleProvider>
        <IconSprite />
        <ToolbarSearchForm
          ariaLabel="按用户名搜索"
          placeholder="用户名"
          value="release"
          onChange={onChange}
          onSubmit={onSubmit}
        />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "按用户名搜索" }), {
      target: { value: "platform" },
    });
    view.rerender(
      <LocaleProvider>
        <IconSprite />
        <ToolbarSearchForm
          ariaLabel="按用户名搜索"
          placeholder="用户名"
          value="release"
          onChange={onChange}
          onSubmit={onSubmit}
        />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));

    expect(onChange).toHaveBeenCalledWith("platform");
    expect(onSubmit).toHaveBeenCalledWith("platform");
  });
});
