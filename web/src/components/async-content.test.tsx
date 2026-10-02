import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { lazy, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../app/locale-context";
import { AsyncContent } from "./async-content";
import { ControlDialog } from "./control-dialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("async page and dialog loading", () => {
  it("shows a loading state and resolves the page without losing its local state on route changes", async () => {
    function Page() {
      const [count, setCount] = useState(0);
      return <button onClick={() => setCount(count + 1)}>{count}</button>;
    }
    let resolve!: (module: { default: typeof Page }) => void;
    const PageModule = lazy(
      () =>
        new Promise<{ default: typeof Page }>((complete) => {
          resolve = complete;
        }),
    );
    const renderPage = (path: string) => (
      <LocaleProvider>
        <AsyncContent resetKey={path}>
          <PageModule />
        </AsyncContent>
      </LocaleProvider>
    );
    const { rerender } = render(renderPage("projects/team/repositories"));
    expect(screen.getByRole("status")).toHaveTextContent("正在加载页面");
    await act(() => Promise.resolve(resolve({ default: Page })));
    fireEvent.click(screen.getByRole("button", { name: "0" }));
    rerender(renderPage("projects/team/settings"));
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
  });

  it("shows a usable error and recovers when navigating to another page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const BrokenPage = lazy(() =>
      Promise.reject(new Error("Chunk unavailable")),
    );
    const { rerender } = render(
      <LocaleProvider>
        <AsyncContent resetKey="system">
          <BrokenPage />
        </AsyncContent>
      </LocaleProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("无法加载页面");
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    rerender(
      <LocaleProvider>
        <AsyncContent resetKey="overview">
          <p>Overview recovered</p>
        </AsyncContent>
      </LocaleProvider>,
    );
    expect(screen.getByText("Overview recovered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps dialog loading modal, preserves focus when loaded, and restores the opener when closed", async () => {
    function Dialog({ onClose }: { onClose: () => void }) {
      return (
        <ControlDialog
          title="Create"
          submitLabel="Save"
          onClose={onClose}
          onSubmit={vi.fn()}
        >
          <input aria-label="Name" />
        </ControlDialog>
      );
    }
    let resolve!: (module: { default: typeof Dialog }) => void;
    const DialogModule = lazy(
      () =>
        new Promise<{ default: typeof Dialog }>((complete) => {
          resolve = complete;
        }),
    );
    function Fixture() {
      const [open, setOpen] = useState(false);
      const close = () => setOpen(false);
      return (
        <LocaleProvider>
          <button onClick={() => setOpen(true)}>Open</button>
          {open ? (
            <AsyncContent resetKey="create" onClose={close}>
              <DialogModule onClose={close} />
            </AsyncContent>
          ) : null}
        </LocaleProvider>
      );
    }
    render(<Fixture />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
    expect(document.body).toHaveClass("overlay-open");
    await act(() => Promise.resolve(resolve({ default: Dialog })));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus(),
    );
    opener.focus();
    expect(screen.getByRole("dialog")).toContainElement(
      document.activeElement as HTMLElement,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body).not.toHaveClass("overlay-open");
  });

  it("can close a loading dialog before its module resolves", async () => {
    const PendingDialog = lazy(() => new Promise<never>(() => undefined));
    const close = vi.fn();
    render(
      <LocaleProvider>
        <AsyncContent resetKey="create" onClose={close}>
          <PendingDialog />
        </AsyncContent>
      </LocaleProvider>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });
});
