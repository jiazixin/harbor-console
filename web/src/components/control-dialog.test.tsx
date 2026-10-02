import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../app/locale-context";
import { ControlDialog } from "./control-dialog";
import { UnifiedSelect } from "./unified-select";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Fixture({
  submit = () => Promise.resolve(),
}: {
  submit?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("a");
  return (
    <LocaleProvider>
      <button onClick={() => setOpen(true)}>Open</button>
      <button>Background</button>
      {open ? (
        <ControlDialog
          title="Test dialog"
          subtitle="Description"
          submitLabel="Save"
          onClose={() => setOpen(false)}
          onSubmit={submit}
        >
          <input aria-label="Name" name="name" />
          <UnifiedSelect
            ariaLabel="Choice"
            value={value}
            onChange={setValue}
            options={[
              { value: "a", label: "A" },
              { value: "b", label: "B" },
            ]}
          />
          <input aria-label="Next field" />
        </ControlDialog>
      ) : null}
    </LocaleProvider>
  );
}

async function openDialog(submit?: () => Promise<void>) {
  render(<Fixture submit={submit} />);
  const opener = screen.getByRole("button", { name: "Open" });
  opener.focus();
  fireEvent.click(opener);
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus(),
  );
  return opener;
}

describe("ControlDialog lifecycle", () => {
  it("cycles boundary focus, blocks background focus and restores the opener", async () => {
    const opener = await openDialog();
    expect(document.body).toHaveClass("overlay-open");
    const save = screen.getByRole("button", { name: "Save" });
    const close = screen.getByRole("button", { name: "关闭" });
    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();
    screen.getByRole("button", { name: "Background" }).focus();
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("overlay-open");
    expect(opener).toHaveFocus();
  });

  it("closes only the portaled select on Escape and permits its option focus", async () => {
    await openDialog();
    const trigger = screen.getByRole("button", { name: "Choice" });
    fireEvent.click(trigger);
    const option = screen.getByRole("option", { name: "B" });
    option.focus();
    expect(option).toHaveFocus();
    fireEvent.keyDown(option, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("tabs from portaled options to the next logical dialog field", async () => {
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Choice" }));
    const option = screen.getByRole("option", { name: "A" });
    option.focus();
    fireEvent.keyDown(option, { key: "Tab" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Next field" })).toHaveFocus();
  });

  it("guards duplicate submission and Escape, then clears busy after success", async () => {
    let resolve!: () => void;
    const submit = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    await openDialog(submit);
    const form = screen.getByRole("dialog").querySelector("form");
    if (!form) throw new Error("Missing dialog form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => {
      resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "false");
  });

  it("announces submission failure and permits retry", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce(undefined);
    await openDialog(submit);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
