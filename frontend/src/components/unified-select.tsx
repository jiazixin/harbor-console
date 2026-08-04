import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { Icon } from "./icons";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

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
  const [open, setOpen] = useState(false);
  const selected: SelectOption<T> | undefined = options.length
    ? (options.find((option) => option.value === value) ?? options[0])
    : undefined;
  const unavailable = disabled || options.length === 0;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (unavailable) setOpen(false);
  }, [unavailable]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => {
        rootRef.current
          ?.querySelector<HTMLButtonElement>(
            '[aria-selected="true"]:not(:disabled)',
          )
          ?.focus({ preventScroll: true });
      });
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const buttons = Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>(
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
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      buttons[event.key === "Home" ? 0 : buttons.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      rootRef.current
        ?.querySelector<HTMLButtonElement>(".unified-select-trigger")
        ?.focus();
    }
  }

  return (
    <span
      ref={rootRef}
      className={`unified-select ${className}${open ? " is-open" : ""}`.trim()}
    >
      {name ? (
        <input type="hidden" name={name} value={value} disabled={disabled} />
      ) : null}
      <button
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
      <span
        id={id}
        className="unified-select-menu"
        role="listbox"
        aria-label={ariaLabel}
        hidden={!open}
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
              rootRef.current
                ?.querySelector<HTMLButtonElement>(".unified-select-trigger")
                ?.focus();
            }}
            onKeyDown={handleOptionKeyDown}
          >
            {option.label}
          </button>
        ))}
      </span>
    </span>
  );
}
