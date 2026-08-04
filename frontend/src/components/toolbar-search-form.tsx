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
  const inputRef = useRef<HTMLInputElement>(null);
  const translatedPlaceholder = t(placeholder);

  return (
    <form
      className={`toolbar-search control-search-form ${className}`.trim()}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit((inputRef.current?.value ?? value).trim());
      }}
    >
      <Icon name="search" />
      <input
        ref={inputRef}
        name={name}
        type="search"
        maxLength={maxLength}
        value={value}
        placeholder={translatedPlaceholder}
        aria-label={ariaLabel ? t(ariaLabel) : translatedPlaceholder}
        onChange={(event) => onChange(event.currentTarget.value)}
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
