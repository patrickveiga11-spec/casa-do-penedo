import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function setLink(rel: string, href: string, attrs: Record<string, string> = {}) {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
  for (const [key, value] of Object.entries(attrs)) {
    link.setAttribute(key, value);
  }
}

function setMeta(name: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

/** Troca manifest/ícones: público (/reservar) vs gestão (/gestao). Scopes separados. */
export function PwaHead() {
  const { pathname } = useLocation();
  const isGestao = pathname.startsWith("/gestao");

  useEffect(() => {
    if (isGestao) {
      document.title = "Casa do Penedo — Gestão";
      setLink("manifest", "/manifest-gestao.webmanifest");
      setLink("icon", "/icon-gestao-192.png", { type: "image/png" });
      setLink("apple-touch-icon", "/icon-gestao-192.png");
      setMeta("theme-color", "#1a1a1a");
      setMeta("apple-mobile-web-app-title", "Penedo Gestão");
      return;
    }

    document.title = "Casa do Penedo — Reservar";
    setLink("manifest", "/manifest.webmanifest");
    setLink("icon", "/icon-192.png", { type: "image/png" });
    setLink("apple-touch-icon", "/icon-192.png");
    setMeta("theme-color", "#2d6a4f");
    setMeta("apple-mobile-web-app-title", "Penedo");
  }, [isGestao]);

  return null;
}
