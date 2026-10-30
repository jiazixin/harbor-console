import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TestProviders } from "../test/test-providers";
import { setupUser } from "../test/user";
import { IconSprite } from "./icon-sprite";
import { ToolbarSearchForm } from "./toolbar-search-form";

describe("ToolbarSearchForm", () => {
  it("submits the current draft across a stale parent rerender", async () => {
    const user = setupUser();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const view = render(
      <TestProviders>
        <IconSprite />
        <ToolbarSearchForm
          ariaLabel="按用户名搜索"
          placeholder="用户名"
          value="release"
          onChange={onChange}
          onSubmit={onSubmit}
        />
      </TestProviders>,
    );

    // The parent never applies onChange, so replace the text in one paste.
    await user.tripleClick(
      screen.getByRole("searchbox", { name: "按用户名搜索" }),
    );
    await user.paste("platform");
    view.rerender(
      <TestProviders>
        <IconSprite />
        <ToolbarSearchForm
          ariaLabel="按用户名搜索"
          placeholder="用户名"
          value="release"
          onChange={onChange}
          onSubmit={onSubmit}
        />
      </TestProviders>,
    );
    await user.click(screen.getByRole("button", { name: "搜索" }));

    expect(onChange).toHaveBeenCalledWith("platform");
    expect(onSubmit).toHaveBeenCalledWith("platform");
  });
});
