import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { interpolate, localeToIntl, translations, type Locale, type TranslationKeys } from "./translations";

const STORAGE_KEY = "casa-locale";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
  intlLocale: string;
  formatMessage: (key: "thankYou" | "emailSent", vars: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function parseLocale(value: string | null): Locale | null {
  if (value === "pt" || value === "en" || value === "fr") {
    return value;
  }
  return null;
}

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "pt";
  }

  const fromUrl = parseLocale(new URLSearchParams(window.location.search).get("lang"));
  if (fromUrl) {
    return fromUrl;
  }

  const fromStorage = parseLocale(localStorage.getItem(STORAGE_KEY));
  if (fromStorage) {
    return fromStorage;
  }

  const browser = navigator.language.toLowerCase();
  if (browser.startsWith("fr")) return "fr";
  if (browser.startsWith("en")) return "en";
  return "pt";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  function setLocale(next: Locale) {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => {
    const t = translations[locale];

    return {
      locale,
      setLocale,
      t,
      intlLocale: localeToIntl(locale),
      formatMessage(key, vars) {
        const raw = t[key];
        return interpolate(raw, vars);
      },
    };
  }, [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
