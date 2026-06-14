import { useEffect, useState } from "react";
import { LogoHeader } from "./LogoHeader";
import { api } from "../api";
import { clearAdminToken, getAdminToken } from "../lib/admin-session";

interface AdminGateProps {
  children: React.ReactNode;
}

export function AdminGate({ children }: AdminGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(getAdminToken()));
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (!getAdminToken()) {
      setCheckingSession(false);
      return;
    }

    api
      .verifyAdminSession()
      .then(() => setAuthenticated(true))
      .catch(() => clearAdminToken())
      .finally(() => setCheckingSession(false));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.loginAdmin(password);
      setAuthenticated(true);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return <div className="theme-admin app-shell">A verificar acesso…</div>;
  }

  if (authenticated) {
    return <div className="theme-admin">{children}</div>;
  }

  return (
    <div className="theme-admin app-shell">
      <LogoHeader subtitle="Área de gestão — acesso reservado ao proprietário" />
      <section className="panel admin-login">
        <h2>Entrar na gestão</h2>
        <p className="muted-text">Esta área é só para ti. Os hóspedes usam a página de reservas.</p>
        <form className="stack" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="adminPassword">Password</label>
            <input
              id="adminPassword"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <div className="alert">{error}</div>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "A verificar…" : "Entrar"}
          </button>
        </form>
      </section>
    </div>
  );
}
