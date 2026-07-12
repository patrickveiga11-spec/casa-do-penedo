import { useState } from "react";
import { api, type PricingRule } from "../api";
import { useLanguage } from "../i18n/LanguageContext";
import { interpolate } from "../i18n/translations";

function formatRuleBadge(rule: PricingRule) {
  if (rule.modifierType === "PACKAGE") {
    return `${Number(rule.modifier)}€`;
  }

  if (rule.modifierType === "PERCENT") {
    const value = Number(rule.modifier);
    return `${value > 0 ? "+" : ""}${value}%`;
  }

  return `${Number(rule.modifier)}€`;
}

function formatRuleDetail(rule: PricingRule, publicPage: boolean, p: ReturnType<typeof useLanguage>["t"]["pricing"] | null) {
  if (rule.modifierType === "PACKAGE" && rule.minNights) {
    if (rule.minNights === 1) {
      return publicPage ? p!.singleNightDetail : "Qualquer dia da semana";
    }

    return publicPage
      ? interpolate(p!.packageNights, { n: rule.minNights })
      : `Pacote de ${rule.minNights} noites`;
  }

  if (rule.minNights) {
    return publicPage ? interpolate(p!.minNights, { n: rule.minNights }) : `Mínimo ${rule.minNights} noites`;
  }

  return null;
}

function sortRules(rules: PricingRule[]) {
  return [...rules].sort((a, b) => {
    if (a.modifierType === "PACKAGE" && b.modifierType === "PACKAGE") {
      return (a.minNights ?? 0) - (b.minNights ?? 0);
    }

    if (a.modifierType === "PACKAGE") return -1;
    if (b.modifierType === "PACKAGE") return 1;

    return b.priority - a.priority;
  });
}

export function PricingInfo({
  rules,
  publicPage = false,
  onRulesUpdated,
}: {
  rules: PricingRule[];
  publicPage?: boolean;
  onRulesUpdated?: () => void;
}) {
  const { t } = useLanguage();
  const p = publicPage ? t.pricing : null;
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const visibleRules = sortRules(publicPage ? rules.filter((rule) => rule.isActive) : rules);

  async function handleToggleRule(rule: PricingRule) {
    if (!onRulesUpdated) return;

    setTogglingRuleId(rule.id);
    setToggleError(null);

    try {
      await api.updatePricingRule(rule.id, { isActive: !rule.isActive });
      onRulesUpdated();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "Erro ao actualizar tarifa");
    } finally {
      setTogglingRuleId(null);
    }
  }

  return (
    <section className="panel">
      <h2>{publicPage ? p!.title : "Tarifas"}</h2>
      {!publicPage && (
        <p className="muted-text panel-hint">
          Suspende temporariamente uma fórmula (ex.: desconto de estadia longa) sem a apagar. As fórmulas inactivas
          deixam de aplicar-se a novos orçamentos.
        </p>
      )}
      {toggleError && <div className="alert">{toggleError}</div>}
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

        {visibleRules.map((rule) => {
          const detail = formatRuleDetail(rule, publicPage, p);

          return (
            <div className={`list-item pricing-rule-item${rule.isActive ? "" : " pricing-rule-inactive"}`} key={rule.id}>
              <div>
                <strong>{rule.name}</strong>
                {detail ? <div className="muted-text">{detail}</div> : null}
                {!publicPage && (
                  <div className="pricing-rule-status">
                    <span className={`badge ${rule.isActive ? "badge-ok" : "badge-pending"}`}>
                      {rule.isActive ? "Activa" : "Suspensa"}
                    </span>
                  </div>
                )}
              </div>
              <div className="pricing-rule-actions">
                <span className="badge">{formatRuleBadge(rule)}</span>
                {!publicPage && onRulesUpdated && (
                  <button
                    type="button"
                    className="btn secondary btn-small"
                    disabled={togglingRuleId === rule.id}
                    onClick={() => handleToggleRule(rule)}
                  >
                    {togglingRuleId === rule.id
                      ? "A guardar…"
                      : rule.isActive
                        ? "Suspender"
                        : "Activar"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!publicPage && (
          <div className="list-item">
            <div>
              <strong>Hóspede extra</strong>
              <div className="muted-text">8.º a 10.º hóspede</div>
            </div>
            <span className="badge">+15€/noite</span>
          </div>
        )}
      </div>
    </section>
  );
}
