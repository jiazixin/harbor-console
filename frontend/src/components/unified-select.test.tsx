import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { UnifiedSelect } from "./unified-select";

afterEach(cleanup);

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
    expect(screen.getByRole("listbox", { hidden: true })).not.toBeVisible();
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
