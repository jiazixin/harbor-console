import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { englishMessages, englishTemplates } from "./locale-messages";
import { createEnglishTranslator } from "./message-templates";
import type { Locale } from "./models";
import {
  readStoredItem,
  writeStoredItem,
} from "../lib/browser-storage/storage";

const storageKey = "harbor-console-language";
const translateToEnglish = createEnglishTranslator([
  ...englishMessages,
  ...englishTemplates,
]);

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (source: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function readStoredLocale(): Locale {
  return readStoredItem("localStorage", storageKey) === "en-US"
    ? "en-US"
    : "zh-CN";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(readStoredLocale);
  const setLocale = useCallback((next: Locale) => {
    document.documentElement.classList.add("language-reload-in");
    writeStoredItem("localStorage", storageKey, next);
    updateLocale(next);
    window.setTimeout(
      () => document.documentElement.classList.remove("language-reload-in"),
      340,
    );
  }, []);
  const t = useCallback(
    (source: string) =>
      locale === "en-US" ? translateToEnglish(source) : source,
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within LocaleProvider");
  return value;
}
