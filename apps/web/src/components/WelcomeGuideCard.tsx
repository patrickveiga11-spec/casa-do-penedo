import QRCode from "react-qr-code";
import { useLanguage } from "../i18n/LanguageContext";

const GUIDE_PATH = "/guia-boas-vindas.pdf";

function BookIcon() {
  return (
    <svg
      className="welcome-guide-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h6" />
    </svg>
  );
}

export function WelcomeGuideCard() {
  const { t } = useLanguage();
  const guideUrl = `${window.location.origin}${GUIDE_PATH}`;

  return (
    <section className="panel welcome-guide-card" aria-labelledby="welcome-guide-title">
      <div className="welcome-guide-content">
        <div className="welcome-guide-copy">
          <div className="welcome-guide-heading">
            <BookIcon />
            <div>
              <h2 id="welcome-guide-title">{t.welcomeGuide.title}</h2>
              <p className="muted-text">{t.welcomeGuide.description}</p>
            </div>
          </div>
          <a className="welcome-guide-link" href={GUIDE_PATH} target="_blank" rel="noopener noreferrer">
            {t.welcomeGuide.openPdf}
          </a>
        </div>
        <div className="welcome-guide-qr" aria-label={t.welcomeGuide.qrLabel}>
          <QRCode value={guideUrl} size={120} bgColor="#ffffff" fgColor="#1f2933" />
          <span className="muted-text">{t.welcomeGuide.scanHint}</span>
        </div>
      </div>
    </section>
  );
}
