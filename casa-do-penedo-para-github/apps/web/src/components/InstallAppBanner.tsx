import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

const DISMISS_KEY = "casa-penedo-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(ua);
  return isIos && isSafari;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function InstallAppBanner() {
  const { t } = useLanguage();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      return;
    }

    if (localStorage.getItem(DISMISS_KEY) === "1") {
      return;
    }

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    if (isIosSafari()) {
      setShowIosHint(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
    setDeferred(null);
    setShowIosHint(false);
  }

  async function install() {
    if (!deferred) {
      return;
    }

    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") {
      setVisible(false);
    } else {
      dismiss();
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <aside className="install-banner" role="region" aria-label={t.installApp.title}>
      <div className="install-banner-copy">
        <strong>{t.installApp.title}</strong>
        <p>
          {showIosHint && !deferred ? t.installApp.iosHint : t.installApp.description}
        </p>
      </div>
      <div className="install-banner-actions">
        {deferred && (
          <button type="button" className="btn btn-small" onClick={install}>
            {t.installApp.install}
          </button>
        )}
        <button type="button" className="btn secondary btn-small" onClick={dismiss}>
          {t.installApp.dismiss}
        </button>
      </div>
    </aside>
  );
}
