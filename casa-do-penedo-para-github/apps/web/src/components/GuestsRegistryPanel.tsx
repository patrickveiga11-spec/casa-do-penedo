import { useEffect, useState } from "react";
import { api, type Guest } from "../api";
import { formatDate } from "../lib/format";

function downloadCsvBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function GuestsRegistryPanel() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState("");
  const [marketingOnly, setMarketingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGuests() {
      setLoading(true);
      setError(null);

      try {
        const data = await api.getGuests({ search, marketingOnly });
        if (!cancelled) {
          setGuests(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar hóspedes");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const timeout = window.setTimeout(loadGuests, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [search, marketingOnly]);

  async function handleToggleMarketing(guest: Guest) {
    setSavingId(guest.id);
    setError(null);

    try {
      const updated = await api.updateGuest(guest.id, { marketingOptIn: !guest.marketingOptIn });
      setGuests((current) => current.map((item) => (item.id === guest.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao actualizar hóspede");
    } finally {
      setSavingId(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      const blob = await api.exportGuestsCsv(marketingOnly);
      downloadCsvBlob(blob, "hospedes-casa-do-penedo.csv");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao exportar CSV");
    } finally {
      setExporting(false);
    }
  }

  const mailingCount = guests.filter((guest) => guest.marketingOptIn).length;

  return (
    <section className="panel guests-registry" id="admin-guests">
      <div className="guests-registry-header">
        <div>
          <h2>Base de hóspedes</h2>
          <p className="muted-text panel-hint">
            Registo automático a partir das reservas. Usa para contactar hóspedes ou exportar a mailing list.
          </p>
        </div>
        <button type="button" className="btn secondary btn-small" disabled={exporting} onClick={handleExport}>
          {exporting ? "A exportar…" : "Exportar CSV"}
        </button>
      </div>

      <div className="guests-registry-toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar nome, email ou telemóvel…"
          aria-label="Pesquisar hóspedes"
        />
        <label className="guests-filter">
          <input
            type="checkbox"
            checked={marketingOnly}
            onChange={(event) => setMarketingOnly(event.target.checked)}
          />
          Só mailing list (aceita promoções)
        </label>
      </div>

      <p className="muted-text guests-summary">
        {loading
          ? "A carregar…"
          : `${guests.length} hóspede${guests.length === 1 ? "" : "s"}${marketingOnly ? "" : ` · ${mailingCount} na mailing list`}`}
      </p>

      {error && <div className="alert">{error}</div>}

      {!loading && guests.length === 0 ? (
        <p className="empty">Ainda não há hóspedes registados com email.</p>
      ) : (
        <div className="guests-table-wrap">
          <table className="guests-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Telemóvel</th>
                <th>Estadias</th>
                <th>Última estadia</th>
                <th>Promoções</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => (
                <tr key={guest.id}>
                  <td>{guest.name}</td>
                  <td>
                    <a href={`mailto:${guest.email}`}>{guest.email}</a>
                  </td>
                  <td>
                    {guest.phone ? (
                      <a href={`tel:${guest.phone}`}>{guest.phone}</a>
                    ) : (
                      <span className="muted-text">—</span>
                    )}
                  </td>
                  <td>{guest.stayCount}</td>
                  <td>{guest.lastStayAt ? formatDate(guest.lastStayAt) : "—"}</td>
                  <td>
                    <label className="guests-opt-in">
                      <input
                        type="checkbox"
                        checked={guest.marketingOptIn}
                        disabled={savingId === guest.id}
                        onChange={() => handleToggleMarketing(guest)}
                      />
                      {guest.marketingOptIn ? "Sim" : "Não"}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
