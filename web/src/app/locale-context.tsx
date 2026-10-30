import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  readStoredItem,
  writeStoredItem,
} from "../lib/browser-storage/storage";
import { englishMessages, englishTemplates } from "./locale-messages";
import { createEnglishTranslator } from "./message-templates";
import type { Locale } from "./models";

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

type LocaleProviderProps = { children: ReactNode };

export function LocaleProvider({ children }: LocaleProviderProps) {
  const [locale, updateLocale] = useState<Locale>(readStoredLocale);
  const setLocale = useCallback((next: Locale) => {
    writeStoredItem("localStorage", storageKey, next);
    updateLocale(next);
  }, []);
  const t = useCallback(
    (source: string) =>
      locale === "en-US" ? translateToEnglish(source) : source,
    [locale],
  );

  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale]);

  const value = (() => ({ locale, setLocale, t }))();
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within LocaleProvider");
  return value;
}
