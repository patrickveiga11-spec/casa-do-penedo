import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

export type InstallAppVariant = "public" | "gestao";

const DISMISS_KEYS: Record<InstallAppVariant, string> = {
  public: "casa-penedo-install-dismissed-public-v2",
  gestao: "casa-penedo-install-dismissed-gestao-v1",
};

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

export function InstallAppBanner({ variant = "public" }: { variant?: InstallAppVariant }) {
  const { t } = useLanguage();
  const copy = variant === "gestao" ? t.installGestaoApp : t.installApp;
  const dismissKey = DISMISS_KEYS[variant];
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [manualHint, setManualHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      return;
    }

    if (localStorage.getItem(dismissKey) === "1") {
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
  }, [dismissKey]);

  function dismiss() {
    localStorage.setItem(dismissKey, "1");
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

  const hint = deferred ? copy.description : isIosSafari() ? copy.iosHint : copy.manualHint;

  return (
    <aside className="install-banner" role="region" aria-label={copy.title}>
      <div className="install-banner-copy">
        <strong>{copy.title}</strong>
        <p>{hint}</p>
        {manualHint && !deferred ? <p className="install-banner-note">{copy.separateNote}</p> : null}
      </div>
      <div className="install-banner-actions">
        {deferred && (
          <button type="button" className="btn btn-small" onClick={install}>
            {copy.install}
          </button>
        )}
        <button type="button" className="btn secondary btn-small" onClick={dismiss}>
          {copy.dismiss}
        </button>
      </div>
    </aside>
  );
}
