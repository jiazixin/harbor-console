import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentTransition } from "./content-transition";

const originalAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "animate",
);
afterEach(() => {
  cleanup();
  if (originalAnimate)
    Object.defineProperty(Element.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(Element.prototype, "animate");
  vi.restoreAllMocks();
});

describe("ContentTransition", () => {
  it("preserves a draft across mode changes and ignores data-only rerenders", () => {
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel }) as unknown as Animation);
    Element.prototype.animate = animate;
    const view = (mode: string, count: number) => (
      <ContentTransition mode={mode}>
        <input aria-label="Draft" defaultValue="" />
        <span>{count}</span>
      </ContentTransition>
    );
    const { rerender, unmount } = render(view("list", 1));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "unsaved" } });
    expect(animate).not.toHaveBeenCalled();
    rerender(view("list", 2));
    expect(animate).not.toHaveBeenCalled();
    rerender(view("card", 2));
    expect(animate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveValue("unsaved");
    rerender(view("list", 2));
    expect(cancel).toHaveBeenCalledTimes(1);
    unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("does not start a content animation when reduced motion is enabled", () => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    Object.defineProperty(media, "matches", { value: true });
    vi.spyOn(window, "matchMedia").mockReturnValue(media);
    const animate = vi.fn();
    Element.prototype.animate = animate;
    const { rerender } = render(
      <ContentTransition mode="a">A</ContentTransition>,
    );
    rerender(<ContentTransition mode="b">B</ContentTransition>);
    expect(screen.getByText("B")).toBeVisible();
    expect(animate).not.toHaveBeenCalled();
  });
});
