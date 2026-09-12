import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { Icon } from "./icons";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 280;
const VIEWPORT_PADDING = 8;

type MenuPlacement = "top" | "bottom";

export function UnifiedSelect<T extends string>({
  ariaLabel,
  className = "",
  disabled = false,
  name,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusOnOpen = useRef(false);
  const menuRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<MenuPlacement>("bottom");
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const selected: SelectOption<T> | undefined = options.length
    ? (options.find((option) => option.value === value) ?? options[0])
    : undefined;
  const unavailable = disabled || options.length === 0;

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportLeft = visualViewport?.offsetLeft ?? 0;
    const viewportWidth =
      visualViewport?.width ?? document.documentElement.clientWidth;
    const viewportHeight =
      visualViewport?.height ?? document.documentElement.clientHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const availableAbove = Math.max(
      0,
      triggerRect.top - viewportTop - VIEWPORT_PADDING - MENU_GAP,
    );
    const availableBelow = Math.max(
      0,
      viewportBottom - triggerRect.bottom - VIEWPORT_PADDING - MENU_GAP,
    );
    const naturalHeight = Math.min(menu.scrollHeight, MENU_MAX_HEIGHT);
    const placement: MenuPlacement =
      availableBelow < naturalHeight && availableAbove > availableBelow
        ? "top"
        : "bottom";
    const availableHeight =
      placement === "top" ? availableAbove : availableBelow;
    const maxHeight = Math.min(MENU_MAX_HEIGHT, availableHeight);
    const renderedHeight = Math.min(naturalHeight, maxHeight);
    const width = Math.max(
      0,
      Math.min(triggerRect.width, viewportWidth - VIEWPORT_PADDING * 2),
    );
    const left = Math.min(
      Math.max(triggerRect.left, viewportLeft + VIEWPORT_PADDING),
      viewportRight - VIEWPORT_PADDING - width,
    );
    const top =
      placement === "top"
        ? triggerRect.top - MENU_GAP - renderedHeight
        : triggerRect.bottom + MENU_GAP;

    setMenuPlacement(placement);
    setMenuStyle((current) => {
      if (
        current.top === top &&
        current.left === left &&
        current.width === width &&
        current.maxHeight === maxHeight
      ) {
        return current;
      }
      return { top, left, width, maxHeight };
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    updateMenuPosition();
    if (focusOnOpen.current) {
      focusOnOpen.current = false;
      menuRef.current
        ?.querySelector<HTMLButtonElement>(
          '[aria-selected="true"]:not(:disabled)',
        )
        ?.focus({ preventScroll: true });
    }
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateMenuPosition);
    if (triggerRef.current) resizeObserver?.observe(triggerRef.current);
    if (menuRef.current) resizeObserver?.observe(menuRef.current);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.visualViewport?.addEventListener("resize", updateMenuPosition);
    window.visualViewport?.addEventListener("scroll", updateMenuPosition);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.visualViewport?.removeEventListener("resize", updateMenuPosition);
      window.visualViewport?.removeEventListener("scroll", updateMenuPosition);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (unavailable) setOpen(false);
  }, [unavailable]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      focusOnOpen.current = true;
      setOpen(true);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const buttons = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        ".unified-select-option:not(:disabled)",
      ) ?? [],
    );
    const index = buttons.indexOf(event.currentTarget);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      buttons[
        (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
          buttons.length
      ]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      buttons[event.key === "Home" ? 0 : buttons.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  const menu = open ? (
    <span
      ref={menuRef}
      id={id}
      className="unified-select-menu"
      role="listbox"
      aria-label={ariaLabel}
      data-placement={menuPlacement}
      style={menuStyle}
    >
      {options.map((option) => (
        <button
          key={option.value}
          className="unified-select-option"
          type="button"
          role="option"
          aria-selected={option.value === value}
          disabled={option.disabled}
          title={option.label}
          onClick={() => {
            onChange(option.value);
            setOpen(false);
            triggerRef.current?.focus();
          }}
          onKeyDown={handleOptionKeyDown}
        >
          {option.label}
        </button>
      ))}
    </span>
  ) : null;

  return (
    <span
      ref={rootRef}
      className={`unified-select ${className}${open ? " is-open" : ""}`.trim()}
    >
      {name ? (
        <input type="hidden" name={name} value={value} disabled={disabled} />
      ) : null}
      <button
        ref={triggerRef}
        className="unified-select-trigger"
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        disabled={unavailable}
        title={selected?.label ?? ""}
        onClick={() => {
          if (!unavailable) setOpen((current) => !current);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="unified-select-label">{selected?.label ?? ""}</span>
        <Icon name="chevron" />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </span>
  );
}
