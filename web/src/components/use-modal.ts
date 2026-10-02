import { type RefObject, useEffect, useRef } from "react";

const modalStack: symbol[] = [];
let previousLocks: boolean[] = [];
const focusableSelector =
  'a[href], button, input:not([type="hidden"]), textarea, select, [tabindex]';

/** Shared focus and scroll lifecycle, including selects portaled to the body. */
export function useModal({
  open,
  dialogRef,
  onClose,
  initialFocusSelector,
}: {
  open: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  initialFocusSelector?: string | null;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const token = Symbol("modal");
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const roots = [document.documentElement, document.body];
    if (modalStack.length === 0) {
      previousLocks = roots.map((root) =>
        root.classList.contains("overlay-open"),
      );
    }
    modalStack.push(token);
    roots.forEach((root) => root.classList.add("overlay-open"));
    const isTopmost = () => modalStack.at(-1) === token;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          !element.closest("[hidden], [inert]") &&
          getComputedStyle(element).display !== "none" &&
          getComputedStyle(element).visibility !== "hidden",
      );
    const portalOwner = (target: Element) => {
      const listbox = target.closest('[role="listbox"]');
      return listbox
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>("[aria-controls]"),
          ).find(
            (element) => element.getAttribute("aria-controls") === listbox.id,
          )
        : undefined;
    };
    const timer = window.setTimeout(() => {
      if (!isTopmost()) return;
      const first = initialFocusSelector
        ? focusable().find((element) => element.matches(initialFocusSelector))
        : null;
      (first ?? dialog).focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost() || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const active = document.activeElement;
      const owner = active instanceof Element ? portalOwner(active) : undefined;
      const index = elements.indexOf((owner ?? active) as HTMLElement);
      if (
        owner ||
        index < 0 ||
        (event.shiftKey ? index === 0 : index === elements.length - 1)
      ) {
        event.preventDefault();
        const next =
          index < 0
            ? event.shiftKey
              ? elements.length - 1
              : 0
            : (index + (event.shiftKey ? -1 : 1) + elements.length) %
              elements.length;
        (elements[next] ?? dialog).focus({ preventScroll: true });
      }
    };
    const handleFocus = (event: FocusEvent) => {
      const target = event.target;
      if (
        isTopmost() &&
        target instanceof Element &&
        !dialog.contains(target) &&
        !portalOwner(target)
      ) {
        (focusable()[0] ?? dialog).focus({ preventScroll: true });
      }
    };
    const handleTabCapture = (event: KeyboardEvent) => {
      // Read the portaled option's logical owner before React unmounts its menu.
      if (event.key === "Tab") handleKeyDown(event);
    };
    document.addEventListener("keydown", handleTabCapture, true);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocus);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleTabCapture, true);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocus);
      const wasTopmost = isTopmost();
      modalStack.splice(modalStack.indexOf(token), 1);
      if (modalStack.length === 0) {
        roots.forEach((root, index) => {
          if (!previousLocks[index]) root.classList.remove("overlay-open");
        });
      }
      if (wasTopmost && opener?.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, [dialogRef, initialFocusSelector, open]);
}
