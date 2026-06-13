export function formatMoney(value: number | string, currency = "EUR") {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(Number(value));
}

export function dateKeyFromIso(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : value;
}

export function formatDate(value: string) {
  const [year, month, day] = dateKeyFromIso(value).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-PT");
}

export function isNightBooked(dayKey: string, checkIn: string, checkOut: string) {
  const start = dateKeyFromIso(checkIn);
  const end = dateKeyFromIso(checkOut);
  return dayKey >= start && dayKey < end;
}

/** Dias entre check-in e check-out escolhidos no formulário (inclusive). */
export function isSelectedStayDay(dayKey: string, checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) {
    return false;
  }

  const start = dateKeyFromIso(checkIn);
  const end = dateKeyFromIso(checkOut);

  if (end < start) {
    return false;
  }

  return dayKey >= start && dayKey <= end;
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthRange(date = new Date()) {
  const start = startOfMonth(date);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    from: toDateKey(start),
    to: toDateKey(end),
    label: start.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }),
  };
}
