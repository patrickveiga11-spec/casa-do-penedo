import { LOCALES } from "../i18n/translations";
import { useLanguage } from "../i18n/LanguageContext";

export function LanguageSelector() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="language-selector" role="group" aria-label="Language">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          className={locale === code ? "active" : undefined}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
