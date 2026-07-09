import { QrImage } from "./QrImage";
import { useLanguage } from "../i18n/LanguageContext";

const RULES_PATH = "/regulamento-interno.pdf";

function RulesIcon() {
  return (
    <svg
      className="regulations-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </svg>
  );
}

export function RegulationsFooter() {
  const { t } = useLanguage();
  const rulesUrl = `${window.location.origin}${RULES_PATH}`;

  return (
    <footer className="regulations-footer" aria-label={t.regulations.title}>
      <div className="regulations-footer-main">
        <RulesIcon />
        <div className="regulations-footer-text">
          <span className="regulations-footer-label">{t.regulations.title}</span>
          <a href={RULES_PATH} target="_blank" rel="noopener noreferrer">
            {t.regulations.openPdf}
          </a>
        </div>
      </div>
      <div className="regulations-footer-qr" aria-hidden="true">
        <QrImage value={rulesUrl} size={56} label={t.regulations.title} />
      </div>
    </footer>
  );
}
