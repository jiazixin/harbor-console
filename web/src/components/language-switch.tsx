import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import uiStyles1 from "./language-switch.module.css";
import uiStyles0 from "./shared-ui.module.css";

type LanguageSwitchProps = { compact?: boolean };

export function LanguageSwitch({ compact = false }: LanguageSwitchProps) {
  const { locale, setLocale, t } = useLocale();
  return (
    <div
      className={resolveClasses(
        `language-switch${compact ? " language-switch-compact" : ""}`,
      )}
      role="group"
      aria-label={t("界面语言")}
      data-active-language={locale}
    >
      <button
        type="button"
        className={resolveClasses(locale === "zh-CN" ? "active" : "")}
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
        className={resolveClasses(locale === "en-US" ? "active" : "")}
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

const resolveClasses = createClassNames({
  "language-switch": uiStyles0.languageSwitch,
  button: uiStyles0.button,
  active: uiStyles0.active,
  "harbor-banner-warning": uiStyles0.harborBannerWarning,
  "harbor-banner-success": uiStyles0.harborBannerSuccess,
  "harbor-banner-info": uiStyles0.harborBannerInfo,
  "harbor-banner-danger": uiStyles0.harborBannerDanger,
  clickable: uiStyles0.clickable,
  "overlay-open": uiStyles0.overlayOpen,
  "log-level-trace": uiStyles0.logLevelTrace,
  "log-level-debug": uiStyles0.logLevelDebug,
  "log-level-log": uiStyles0.logLevelLog,
  "log-level-info": uiStyles0.logLevelInfo,
  "log-level-warn": uiStyles0.logLevelWarn,
  "log-level-error": uiStyles0.logLevelError,
  "log-level-fatal": uiStyles0.logLevelFatal,
  "language-switch-compact": uiStyles1.languageSwitchCompact,
});
