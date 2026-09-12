import { useRef } from "react";

import { useLocale } from "../app/locale-context";
import { Icon } from "./icons";

export function ToolbarSearchForm({
  ariaLabel,
  className = "",
  maxLength = 255,
  name,
  placeholder,
  value,
  onChange,
  onSubmit,
}: {
  ariaLabel?: string;
  className?: string;
  maxLength?: number;
  name?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}) {
  const { t } = useLocale();
  const draftRef = useRef(value);
  const previousValueRef = useRef(value);
  const translatedPlaceholder = t(placeholder);

  if (value !== previousValueRef.current) {
    previousValueRef.current = value;
    draftRef.current = value;
  }

  return (
    <form
      className={`toolbar-search control-search-form ${className}`.trim()}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draftRef.current.trim());
      }}
    >
      <Icon name="search" />
      <input
        name={name}
        type="search"
        maxLength={maxLength}
        value={value}
        placeholder={translatedPlaceholder}
        aria-label={ariaLabel ? t(ariaLabel) : translatedPlaceholder}
        onChange={(event) => {
          draftRef.current = event.currentTarget.value;
          onChange(event.currentTarget.value);
        }}
      />
      <button
        className="icon-button toolbar-search-submit"
        type="submit"
        title={t("搜索")}
        aria-label={t("搜索")}
      >
        <Icon name="search" />
      </button>
    </form>
  );
}
