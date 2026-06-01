import { useState } from "react";

export function LogoHeader({ subtitle }: { subtitle: string }) {
  const [logoSrc, setLogoSrc] = useState("/logo.png");

  return (
    <header className="hero">
      <img
        src={logoSrc}
        alt="Casa do Penedo"
        className="hero-logo"
        onError={() => setLogoSrc("/logo.svg")}
      />
      <p>{subtitle}</p>
    </header>
  );
}
