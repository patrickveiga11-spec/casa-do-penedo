export type GuestAgeCounts = {
  guestsChildren: number;
  guestsYouth: number;
  guestsAdults: number;
  guests: number;
};

export function resolveGuestCounts(input: {
  guestsChildren?: number;
  guestsYouth?: number;
  guestsAdults?: number;
  guests?: number;
}): GuestAgeCounts {
  const hasCategories =
    input.guestsChildren !== undefined ||
    input.guestsYouth !== undefined ||
    input.guestsAdults !== undefined;

  if (hasCategories) {
    const guestsChildren = Math.max(0, Math.floor(input.guestsChildren ?? 0));
    const guestsYouth = Math.max(0, Math.floor(input.guestsYouth ?? 0));
    const guestsAdults = Math.max(0, Math.floor(input.guestsAdults ?? 0));
    return {
      guestsChildren,
      guestsYouth,
      guestsAdults,
      guests: guestsChildren + guestsYouth + guestsAdults,
    };
  }

  const guests = Math.max(1, Math.floor(input.guests ?? 1));
  return {
    guestsChildren: 0,
    guestsYouth: 0,
    guestsAdults: guests,
    guests,
  };
}

export function formatGuestBreakdown(input: {
  guests: number;
  guestsChildren?: number | null;
  guestsYouth?: number | null;
  guestsAdults?: number | null;
}): string {
  const children = input.guestsChildren ?? 0;
  const youth = input.guestsYouth ?? 0;
  const adults = input.guestsAdults ?? 0;
  const categorized = children + youth + adults;

  if (categorized <= 0) {
    return String(input.guests);
  }

  const parts: string[] = [];
  if (adults > 0) parts.push(`${adults} adulto${adults === 1 ? "" : "s"}`);
  if (youth > 0) parts.push(`${youth} jovem${youth === 1 ? "" : "ens"} (13–17)`);
  if (children > 0) parts.push(`${children} criança${children === 1 ? "" : "s"} (0–12)`);

  return parts.join(", ") || String(input.guests);
}
