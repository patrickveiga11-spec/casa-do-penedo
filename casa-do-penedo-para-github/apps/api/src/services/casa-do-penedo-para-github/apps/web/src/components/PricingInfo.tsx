import type { PricingRule } from "../api";

export function PricingInfo({ rules }: { rules: PricingRule[] }) {
  return (
    <section className="panel">
      <h2>Tarifas</h2>
      <div className="stack">
        <div className="list-item">
          <div>
            <strong>Diária</strong>
            <div className="muted-text">Até 7 hóspedes · máximo 10</div>
          </div>
          <span className="badge">100€/noite</span>
        </div>
        <div className="list-item">
          <div>
            <strong>Hóspede extra</strong>
            <div className="muted-text">8.º a 10.º hóspede</div>
          </div>
          <span className="badge">+15€/noite</span>
        </div>
        {rules.map((rule) => (
          <div className="list-item" key={rule.id}>
            <div>
              <strong>{rule.name}</strong>
              {rule.minNights ? <div className="muted-text">Mínimo {rule.minNights} noites</div> : null}
            </div>
            <span className="badge">
              {rule.modifierType === "PERCENT"
                ? `${Number(rule.modifier) > 0 ? "+" : ""}${Number(rule.modifier)}%`
                : `${Number(rule.modifier)}€`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
