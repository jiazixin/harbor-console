import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UnifiedSelect } from "./unified-select";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function elementRect({
  top,
  left,
  width,
  height,
}: {
  top: number;
  left: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    top,
    right: left + width,
    bottom: top + height,
    left,
    width,
    height,
    toJSON: () => ({}),
  };
}

function SelectFixture() {
  const [value, setValue] = useState("daily");
  return (
    <form data-testid="form">
      <UnifiedSelect
        ariaLabel="Frequency"
        name="frequency"
        value={value}
        options={[
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
        ]}
        onChange={setValue}
      />
    </form>
  );
}

describe("UnifiedSelect", () => {
  it("updates the shared trigger and submitted form value", () => {
    render(<SelectFixture />);

    fireEvent.click(screen.getByRole("button", { name: "Frequency" }));
    fireEvent.click(screen.getByRole("option", { name: "Hourly" }));

    expect(screen.getByRole("button", { name: "Frequency" })).toHaveTextContent(
      "Hourly",
    );
    expect(new FormData(screen.getByTestId("form")).get("frequency")).toBe(
      "hourly",
    );
  });

  it("supports keyboard opening, navigation, and focus restoration", () => {
    render(<SelectFixture />);
    const trigger = screen.getByRole("button", { name: "Frequency" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const selected = screen.getByRole("option", { name: "Daily" });
    selected.focus();
    fireEvent.keyDown(selected, { key: "Escape" });

    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("portals the menu and flips it above a trigger near the viewport bottom", () => {
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      768,
    );
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(96);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return this.classList.contains("unified-select-trigger")
          ? elementRect({ top: 700, left: 1040, width: 120, height: 42 })
          : elementRect({ top: 0, left: 0, width: 0, height: 0 });
      },
    );

    render(<SelectFixture />);
    fireEvent.click(screen.getByRole("button", { name: "Frequency" }));

    const menu = screen.getByRole("listbox", { name: "Frequency" });
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveAttribute("data-placement", "top");
    expect(Number.parseFloat(menu.style.top)).toBeLessThan(700);
    expect(Number.parseFloat(menu.style.left)).toBe(1040);
    expect(Number.parseFloat(menu.style.width)).toBe(120);
  });

  it("repositions an open menu when its trigger moves", () => {
    let triggerTop = 100;
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      768,
    );
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(96);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return this.classList.contains("unified-select-trigger")
          ? elementRect({ top: triggerTop, left: 20, width: 140, height: 42 })
          : elementRect({ top: 0, left: 0, width: 0, height: 0 });
      },
    );

    render(<SelectFixture />);
    fireEvent.click(screen.getByRole("button", { name: "Frequency" }));
    const menu = screen.getByRole("listbox", { name: "Frequency" });
    expect(menu).toHaveAttribute("data-placement", "bottom");

    triggerTop = 700;
    fireEvent.scroll(window);
    expect(menu).toHaveAttribute("data-placement", "top");
  });

  it("disables an empty option set without throwing", () => {
    render(
      <UnifiedSelect
        ariaLabel="Empty"
        value=""
        options={[]}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Empty" })).toBeDisabled();
  });
});
