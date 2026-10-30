import { useEffect, useRef, useState } from "react";
import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import { FormInput } from "./form-input";
import uiStyles0 from "./page-jump-control.module.css";
import uiStyles1 from "./shared-ui.module.css";

type PageJumpControlProps = {
  label: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function PageJumpControl({
  label,
  page,
  totalPages,
  onPageChange,
}: PageJumpControlProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(page));
  const controlRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Opening clears the draft, so a closed jump needs no reset.
  useEffect(() => {
    if (!open) return;
    const input = inputRef.current;
    const previous = document.activeElement;
    input?.focus();
    return () => {
      if (document.activeElement === input && previous instanceof HTMLElement)
        previous.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [open]);

  function submit() {
    const requested = Number.parseInt(value, 10);
    const nextPage = Number.isFinite(requested)
      ? Math.min(totalPages, Math.max(1, requested))
      : page;
    setOpen(false);
    setValue(String(nextPage));
    if (nextPage !== page) onPageChange(nextPage);
  }

  return (
    <span
      ref={controlRef}
      className={resolveClasses("pagination-page-control")}
    >
      {open ? (
        <span className={resolveClasses("pagination-page-jump")}>
          <FormInput
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            aria-label={t("页码")}
            onChange={(event) => {
              setValue(event.currentTarget.value);
            }}
            onBlur={() => {
              setOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
              }
            }}
          />
        </span>
      ) : (
        <button
          className={resolveClasses("pagination-page-label")}
          type="button"
          aria-label={t("跳转页码")}
          onClick={() => {
            setValue("");
            setOpen(true);
          }}
        >
          {label}
        </button>
      )}
    </span>
  );
}

const resolveClasses = createClassNames({
  "pagination-page-control": uiStyles0.paginationPageControl,
  "pagination-page-jump": uiStyles0.paginationPageJump,
  "pagination-page-label": uiStyles0.paginationPageLabel,
  button: uiStyles1.button,
  "harbor-banner-warning": uiStyles1.harborBannerWarning,
  "harbor-banner-success": uiStyles1.harborBannerSuccess,
  "harbor-banner-info": uiStyles1.harborBannerInfo,
  "harbor-banner-danger": uiStyles1.harborBannerDanger,
  clickable: uiStyles1.clickable,
  "overlay-open": uiStyles1.overlayOpen,
  "log-level-trace": uiStyles1.logLevelTrace,
  "log-level-debug": uiStyles1.logLevelDebug,
  "log-level-log": uiStyles1.logLevelLog,
  "log-level-info": uiStyles1.logLevelInfo,
  "log-level-warn": uiStyles1.logLevelWarn,
  "log-level-error": uiStyles1.logLevelError,
  "log-level-fatal": uiStyles1.logLevelFatal,
});
