import { LOCALES } from "../i18n/translations";
import { useLanguage } from "../i18n/LanguageContext";

export function LanguageSelector() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="language-selector" role="group" aria-label="Language">
      {LOCALES.map(({ code, label, flag }) => (
        <button
          key={code}
          type="button"
          className={locale === code ? "active" : undefined}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          aria-label={label}
          title={label}
        >
          <span className="language-flag" aria-hidden="true">
            {flag}
          </span>
          <span className="language-code">{label}</span>
        </button>
      ))}
    </div>
  );
}
