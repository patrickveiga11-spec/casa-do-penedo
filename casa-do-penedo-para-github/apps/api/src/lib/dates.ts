export function eachNight(start: Date, end: Date): Date[] {
  const nights: Date[] = [];
  let current = toDateOnly(start);
  const last = toDateOnly(end);

  while (current < last) {
    nights.push(new Date(current));
    current = addDays(current, 1);
  }

  return nights;
}

export function datesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function toDateOnly(value: string | Date): Date {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    }
  }

  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return eachNight(checkIn, checkOut).length;
}

export function monthBounds(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNum - 1, 1));
  const end = new Date(Date.UTC(year, monthNum, 0));

  return {
    start,
    end,
    daysInMonth: end.getUTCDate(),
    label: `${year}-${String(monthNum).padStart(2, "0")}`,
  };
}

export function nightsInRange(checkIn: Date, checkOut: Date, rangeStart: Date, rangeEnd: Date) {
  return eachNight(checkIn, checkOut).filter((night) => night >= rangeStart && night <= rangeEnd).length;
}
