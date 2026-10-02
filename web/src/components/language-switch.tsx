import { useLocale } from "../app/locale-context";

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <div
      className={`language-switch${compact ? " language-switch-compact" : ""}`}
      role="group"
      aria-label={t("界面语言")}
      data-active-language={locale}
    >
      <button
        type="button"
        className={locale === "zh-CN" ? "active" : ""}
        aria-label={locale === "en-US" ? "Switch to Chinese" : "切换为中文"}
        aria-pressed={locale === "zh-CN"}
        onClick={(event) => {
          event.currentTarget.blur();
          setLocale("zh-CN");
        }}
      >
        中文
      </button>
      <button
        type="button"
        className={locale === "en-US" ? "active" : ""}
        aria-label="Switch to English"
        aria-pressed={locale === "en-US"}
        onClick={(event) => {
          event.currentTarget.blur();
          setLocale("en-US");
        }}
      >
        English
      </button>
    </div>
  );
}
