import { useRef } from "react";
import { CalendarIcon } from "./CalendarIcon";

interface DateFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  openCalendarLabel?: string;
  chooseDateLabel?: string;
}

export function DateField({
  id,
  label,
  value,
  onChange,
  required,
  openCalendarLabel = "Abrir calendário",
  chooseDateLabel = "Escolher",
}: DateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.click();
    }
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="date-field">
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        />
        <button
          type="button"
          className="date-field-btn"
          onClick={openPicker}
          aria-label={`${openCalendarLabel}: ${label}`}
          title={`${chooseDateLabel} ${label.toLowerCase()}`}
        >
          <CalendarIcon />
        </button>
      </div>
    </div>
  );
}
