import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

/** Só a app pública — independente da gestão já instalada. */
const DISMISS_KEY = "casa-penedo-install-dismissed-public-v2";

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
  const [manualHint, setManualHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Se já estás DENTRO da app pública instalada, não pedir de novo.
    if (isStandalone()) {
      return;
    }

    if (localStorage.getItem(DISMISS_KEY) === "1") {
      return;
    }

    let gotPrompt = false;

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      gotPrompt = true;
      setDeferred(event as BeforeInstallPromptEvent);
      setManualHint(false);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS nunca dispara beforeinstallprompt — mostra instrução.
    // Android também pode não disparar se a gestão já estiver instalada no mesmo domínio.
    const timer = window.setTimeout(() => {
      if (!gotPrompt) {
        setManualHint(true);
        setVisible(true);
      }
    }, 800);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
    setDeferred(null);
    setManualHint(false);
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

  const hint = deferred
    ? t.installApp.description
    : isIosSafari()
      ? t.installApp.iosHint
      : t.installApp.manualHint;

  return (
    <aside className="install-banner" role="region" aria-label={t.installApp.title}>
      <div className="install-banner-copy">
        <strong>{t.installApp.title}</strong>
        <p>{hint}</p>
        {manualHint && !deferred ? <p className="install-banner-note">{t.installApp.separateNote}</p> : null}
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
