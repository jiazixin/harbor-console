import { useCallback, useEffect, useRef, useState } from "react";
import { instanceApi } from "../app/api-client";
import { useLoadedQuery } from "../app/use-loaded-query";
import type { ShellPanel } from "./application-overlays-support";
import { shellKeys } from "./shell-keys";

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
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpen]);
}

/** Loads the saved Harbor connections while the instance panel is open. */
export function useHarborInstances(open: boolean) {
  const instancesQuery = useLoadedQuery(
    shellKeys.instances,
    (signal) => instanceApi.list(signal).then((collection) => collection.items),
    { enabled: open },
  );
  return {
    instances: instancesQuery.data ?? [],
    error: instancesQuery.error,
    reload: instancesQuery.reload,
    loading: instancesQuery.loading,
  };
}
