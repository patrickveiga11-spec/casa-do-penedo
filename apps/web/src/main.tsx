import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __casaBeforeInstall?: BeforeInstallPromptEvent | null;
  }
}

// Capturar cedo — no Android o evento pode disparar antes do React montar.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.__casaBeforeInstall = event as BeforeInstallPromptEvent;
  window.dispatchEvent(new Event("casa-beforeinstallprompt"));
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => registration.update().catch(() => undefined))
      .catch(() => {
        // Instalação no telemóvel continua possível noutros browsers mesmo se o SW falhar.
      });
  });
}
