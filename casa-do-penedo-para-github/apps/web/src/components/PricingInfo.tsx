import type { PricingRule } from "../api";
import { useLanguage } from "../i18n/LanguageContext";
import { interpolate } from "../i18n/translations";

export function PricingInfo({
  rules,
  publicPage = false,
}: {
  rules: PricingRule[];
  publicPage?: boolean;
}) {
  const { t } = useLanguage();
  const p = publicPage ? t.pricing : null;

  return (
    <section className="panel">
      <h2>{publicPage ? p!.title : "Tarifas"}</h2>
      <div className="stack">
        <div className="list-item">
          <div>
            <strong>{publicPage ? p!.nightly : "Diária"}</strong>
            <div className="muted-text">
              {publicPage ? p!.nightlyDetail : "Até 7 hóspedes · máximo 10"}
            </div>
          </div>
          <span className="badge">100€/noite</span>
        </div>
        <div className="list-item">
          <div>
            <strong>{publicPage ? p!.weekend : "Fim-de-semana (1 noite)"}</strong>
            <div className="muted-text">
              {publicPage ? p!.weekendDetail : "Sexta→sábado ou sábado→domingo"}
            </div>
          </div>
          <span className="badge">200€</span>
        </div>
        {!publicPage && (
          <div className="list-item">
            <div>
              <strong>Hóspede extra</strong>
              <div className="muted-text">8.º a 10.º hóspede</div>
            </div>
            <span className="badge">+15€/noite</span>
          </div>
        )}
        {rules.map((rule) => (
          <div className="list-item" key={rule.id}>
            <div>
              <strong>{rule.name}</strong>
              {rule.minNights ? (
                <div className="muted-text">
                  {publicPage
                    ? interpolate(p!.minNights, { n: rule.minNights })
                    : `Mínimo ${rule.minNights} noites`}
                </div>
              ) : null}
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
