import { useCallback, useEffect, useRef, useState } from "react";

import { instanceApi } from "../app/api-client";
import type { HarborInstance } from "../app/models";
import {
  readStoredItem,
  writeStoredItem,
} from "../lib/browser-storage/storage";
import type { ShellPanel } from "./application-overlays";

type Theme = "dark" | "light";

const themeStorageKey = "harbor-console-theme";

function storedTheme(): Theme {
  return readStoredItem("localStorage", themeStorageKey) === "dark"
    ? "dark"
    : "light";
}

/** The color theme, applied to the document and remembered in this browser. */
export function useTheme() {
  const [theme, setTheme] = useState(storedTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStoredItem("localStorage", themeStorageKey, theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#171717" : "#f7f7f8");
  }, [theme]);
  return [theme, setTheme] as const;
}

/**
 * The top-bar popover panel. Opening moves focus into the panel; Escape or a
 * click outside closes it, and closing returns focus to the opening button.
 */
export function useShellPanel() {
  const [panel, setPanel] = useState<ShellPanel>();
  const panelRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const closePanel = useCallback((restoreFocus = true) => {
    setPanel(undefined);
    const opener = openerRef.current;
    openerRef.current = null;
    if (!restoreFocus) return;
    window.setTimeout(() => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    });
  }, []);

  const togglePanel = useCallback(
    (next: ShellPanel, opener: HTMLElement) => {
      if (panel === next) {
        closePanel();
        return;
      }
      openerRef.current = opener;
      setPanel(next);
    },
    [closePanel, panel],
  );

  /** Focuses the first enabled button in the open panel, or the panel itself. */
  const focusPanel = useCallback(() => {
    const target = panelRef.current?.querySelector<HTMLElement>(
      "button:not(:disabled)",
    );
    (target ?? panelRef.current)?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!panel) return;
    const timer = window.setTimeout(focusPanel);
    const handlePointerDown = (event: MouseEvent) => {
      const clickedOutside =
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target) &&
        !openerRef.current?.contains(event.target);
      if (clickedOutside) closePanel(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePanel, focusPanel, panel]);

  return { panel, panelRef, togglePanel, closePanel, focusPanel };
}

function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** Opens global search with "/" unless the user is typing in a field. */
export function useSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modified = event.altKey || event.ctrlKey || event.metaKey;
      if (event.key !== "/" || modified || isTextEntry(event.target)) return;
      event.preventDefault();
      onOpen();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpen]);
}

/** Loads the saved Harbor connections while the instance panel is open. */
export function useHarborInstances(
  open: boolean,
  onError: (message: string) => void,
) {
  const [instances, setInstances] = useState<HarborInstance[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    void instanceApi
      .list(controller.signal)
      .then((collection) => setInstances(collection.items))
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        onError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [onError, open]);
  return { instances, loading };
}
