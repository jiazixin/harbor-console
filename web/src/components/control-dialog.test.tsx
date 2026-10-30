import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../app/api-client";
import { TestProviders } from "../test/test-providers";
import { setupUser } from "../test/user";
import { ControlDialog } from "./control-dialog";
import { FormInput } from "./form-input";
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
    <TestProviders>
      <button
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </button>
      <button>Background</button>
      {open ? (
        <ControlDialog
          title="Test dialog"
          subtitle="Description"
          submitLabel="Save"
          onClose={() => {
            setOpen(false);
          }}
          onSubmit={submit}
        >
          <FormInput aria-label="Name" name="name" />
          <UnifiedSelect
            ariaLabel="Choice"
            value={value}
            onChange={setValue}
            options={[
              { value: "a", label: "A" },
              { value: "b", label: "B" },
            ]}
          />
          <FormInput aria-label="Next field" />
        </ControlDialog>
      ) : null}
    </TestProviders>
  );
}

async function openDialog(submit?: () => Promise<void>) {
  const user = setupUser();
  render(<Fixture submit={submit} />);
  const opener = screen.getByRole("button", { name: "Open" });
  opener.focus();
  await user.click(opener);
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus(),
  );
  return opener;
}

describe("ControlDialog lifecycle", () => {
  it("associates a server validation failure with its field without exposing internal text", async () => {
    const user = setupUser();
    await openDialog(() =>
      Promise.reject(
        new ApiError("secret database detail", {
          status: 400,
          code: "invalid_argument",
          requestId: "field-error",
          details: { fields: [{ path: "name", reason: "required" }] },
        }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    const name = screen.getByRole("textbox", { name: "Name" });
    await waitFor(() => {
      expect(name).toHaveAttribute("aria-invalid", "true");
    });
    expect(name).toHaveAccessibleDescription();
    expect(
      screen.queryByText("secret database detail"),
    ).not.toBeInTheDocument();
  });

  it("cycles boundary focus, blocks background focus and restores the opener", async () => {
    const user = setupUser();
    const opener = await openDialog();
    expect(document.body).toHaveClass("hc_8b938f52_overlayOpen");
    const save = screen.getByRole("button", { name: "Save" });
    const close = screen.getByRole("button", { name: "关闭" });
    save.focus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(save).toHaveFocus();
    screen.getByRole("button", { name: "Background" }).focus();
    expect(close).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("hc_8b938f52_overlayOpen");
    expect(opener).toHaveFocus();
  });

  it("closes only the portaled select on Escape and permits its option focus", async () => {
    const user = setupUser();
    await openDialog();
    const trigger = screen.getByRole("button", { name: "Choice" });
    await user.click(trigger);
    const option = screen.getByRole("option", { name: "B" });
    option.focus();
    expect(option).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("tabs from portaled options to the next logical dialog field", async () => {
    const user = setupUser();
    await openDialog();
    await user.click(screen.getByRole("button", { name: "Choice" }));
    const option = screen.getByRole("option", { name: "A" });
    option.focus();
    await user.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Next field" })).toHaveFocus();
  });

  it("guards duplicate submission and Escape, then clears busy after success", async () => {
    const user = setupUser();
    let resolve!: () => void;
    const submit = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    await openDialog(submit);
    // Enter twice in the focused field submits the form twice.
    await user.keyboard("{Enter}{Enter}");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => {
      resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "false");
  });

  it("announces submission failure and permits retry", async () => {
    const user = setupUser();
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce(undefined);
    await openDialog(submit);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("请求失败");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
