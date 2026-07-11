import type { MonthlyRevenue } from "../api";
import { formatMoney } from "../lib/format";

export function MonthlyRevenueChart({ data }: { data: MonthlyRevenue }) {
  const maxRevenue = Math.max(...data.months.map((month) => month.revenue), 1);
  const peakMonth = data.months.reduce(
    (best, month) => (month.revenue > best.revenue ? month : best),
    data.months[0]
  );

  return (
    <section className="panel monthly-revenue-chart" aria-label={`Receita mensal ${data.year}`}>
      <div className="monthly-revenue-header">
        <div>
          <h2>Receita por mês — {data.year}</h2>
          <p className="muted-text panel-hint">
            Valor total das reservas por mês de check-in (exclui canceladas).
          </p>
        </div>
        <div className="monthly-revenue-total">
          <span className="muted-text">Total {data.year}</span>
          <strong>{formatMoney(data.totalRevenue)}</strong>
        </div>
      </div>

      <div className="monthly-revenue-bars" role="list">
        {data.months.map((month) => {
          const height = month.revenue > 0 ? Math.max(8, Math.round((month.revenue / maxRevenue) * 100)) : 0;
          const isPeak = month.month === peakMonth.month && month.revenue > 0;

          return (
            <div className="monthly-revenue-bar-item" key={month.month} role="listitem">
              <div
                className={`monthly-revenue-bar${isPeak ? " monthly-revenue-bar-peak" : ""}`}
                style={{ height: `${height}%` }}
                title={`${month.label}: ${formatMoney(month.revenue)} (${month.reservations} reserva${month.reservations === 1 ? "" : "s"})`}
              >
                {month.revenue > 0 && (
                  <span className="monthly-revenue-bar-value">{formatMoney(month.revenue)}</span>
                )}
              </div>
              <span className="monthly-revenue-bar-label">{month.label}</span>
              {month.reservations > 0 && (
                <span className="monthly-revenue-bar-count">{month.reservations}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
