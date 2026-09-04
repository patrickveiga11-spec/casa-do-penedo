import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

export type InstallAppVariant = "public" | "gestao";

const DISMISS_KEYS: Record<InstallAppVariant, string> = {
  public: "casa-penedo-install-dismissed-public-v2",
  gestao: "casa-penedo-install-dismissed-gestao-v3",
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __casaBeforeInstall?: BeforeInstallPromptEvent | null;
  }
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(ua);
  return isIos && isSafari;
}

function isAndroid() {
  return /Android/i.test(window.navigator.userAgent);
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
  const [visible, setVisible] = useState(false);
  const [runningStandalone, setRunningStandalone] = useState(false);
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    const standalone = isStandalone();
    setRunningStandalone(standalone);
    setAndroid(isAndroid());

    if (standalone && variant === "public") {
      return;
    }

    if (localStorage.getItem(dismissKey) === "1") {
      return;
    }

    setVisible(true);

    function takePrompt(event?: BeforeInstallPromptEvent | null) {
      const promptEvent = event ?? window.__casaBeforeInstall ?? null;
      if (!promptEvent) {
        return;
      }
      setDeferred(promptEvent);
    }

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      const bip = event as BeforeInstallPromptEvent;
      window.__casaBeforeInstall = bip;
      takePrompt(bip);
    }

    function onCasaBip() {
      takePrompt();
    }

    takePrompt();
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("casa-beforeinstallprompt", onCasaBip);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("casa-beforeinstallprompt", onCasaBip);
    };
  }, [dismissKey, variant]);

  function dismiss() {
    localStorage.setItem(dismissKey, "1");
    setVisible(false);
    setDeferred(null);
  }

  async function install() {
    const promptEvent = deferred ?? window.__casaBeforeInstall;
    if (!promptEvent) {
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    window.__casaBeforeInstall = null;
    setDeferred(null);
    if (choice.outcome === "accepted") {
      setVisible(false);
      localStorage.setItem(dismissKey, "1");
    }
  }

  if (!visible) {
    return null;
  }

  let hint: string = copy.manualHint;
  if (deferred) {
    hint = copy.description;
  } else if (runningStandalone && variant === "gestao") {
    hint = t.installGestaoApp.standaloneHint;
  } else if (android && variant === "gestao") {
    hint = t.installGestaoApp.androidHint;
  } else if (isIosSafari()) {
    hint = copy.iosHint;
  }

  return (
    <aside className={`install-banner${variant === "gestao" ? " install-banner-gestao" : ""}`} role="region" aria-label={copy.title}>
      <div className="install-banner-copy">
        <strong>{copy.title}</strong>
        <p>{hint}</p>
        {!deferred ? <p className="install-banner-note">{copy.separateNote}</p> : null}
      </div>
      <div className="install-banner-actions">
        {deferred ? (
          <button type="button" className="btn btn-small" onClick={install}>
            {copy.install}
          </button>
        ) : null}
        <button type="button" className="btn secondary btn-small" onClick={dismiss}>
          {copy.dismiss}
        </button>
      </div>
    </aside>
  );
}
