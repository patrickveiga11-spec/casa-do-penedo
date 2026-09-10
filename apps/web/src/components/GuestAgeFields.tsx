export type GuestAgeValue = number | "";

export function parseGuestAgeValue(value: GuestAgeValue): number {
  if (value === "" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

type GuestAgeFieldsProps = {
  idPrefix?: string;
  maxGuests: number;
  adults: GuestAgeValue;
  youth: GuestAgeValue;
  children: GuestAgeValue;
  onAdultsChange: (value: GuestAgeValue) => void;
  onYouthChange: (value: GuestAgeValue) => void;
  onChildrenChange: (value: GuestAgeValue) => void;
  labels: {
    adults: string;
    youth: string;
    children: string;
    total: string;
  };
};

function handleGuestInput(
  raw: string,
  onChange: (value: GuestAgeValue) => void
) {
  if (raw === "") {
    onChange("");
    return;
  }
  const next = Number(raw);
  if (!Number.isFinite(next)) return;
  onChange(Math.max(0, Math.floor(next)));
}

export function GuestAgeFields({
  idPrefix = "guests",
  maxGuests,
  adults,
  youth,
  children,
  onAdultsChange,
  onYouthChange,
  onChildrenChange,
  labels,
}: GuestAgeFieldsProps) {
  const total =
    parseGuestAgeValue(adults) + parseGuestAgeValue(youth) + parseGuestAgeValue(children);

  return (
    <div className="guest-age-group">
      <div className="field-row guest-age-fields">
        <div className="field">
          <label htmlFor={`${idPrefix}-adults`}>{labels.adults}</label>
          <input
            id={`${idPrefix}-adults`}
            type="number"
            inputMode="numeric"
            min={0}
            max={maxGuests}
            value={adults}
            onChange={(event) => handleGuestInput(event.target.value, onAdultsChange)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-youth`}>{labels.youth}</label>
          <input
            id={`${idPrefix}-youth`}
            type="number"
            inputMode="numeric"
            min={0}
            max={maxGuests}
            value={youth}
            onChange={(event) => handleGuestInput(event.target.value, onYouthChange)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-children`}>{labels.children}</label>
          <input
            id={`${idPrefix}-children`}
            type="number"
            inputMode="numeric"
            min={0}
            max={maxGuests}
            value={children}
            onChange={(event) => handleGuestInput(event.target.value, onChildrenChange)}
          />
        </div>
      </div>
      <p className="guest-age-total">
        {labels.total}: <strong>{total}</strong>
      </p>
    </div>
  );
}
