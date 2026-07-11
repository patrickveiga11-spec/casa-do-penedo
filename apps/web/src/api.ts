import { clearAdminToken, getAdminToken, setAdminToken } from "./lib/admin-session";

const API_URL = import.meta.env.VITE_API_URL ?? "";

type RequestOptions = RequestInit & { admin?: boolean };

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const { admin, ...fetchOptions } = options ?? {};
  const headers = new Headers(fetchOptions.headers);

  if (fetchOptions.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (admin) {
    const token = getAdminToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error ?? error.message ?? "Erro na API");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export const api = {
  hasAdminSession: () => Boolean(getAdminToken()),

  loginAdmin: async (password: string) => {
    const result = await request<{ token: string }>("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    setAdminToken(result.token);
    return result;
  },

  logoutAdmin: async () => {
    try {
      await request("/auth/admin/logout", { method: "POST", admin: true });
    } finally {
      clearAdminToken();
    }
  },

  verifyAdminSession: async () => {
    await request("/auth/admin/session", { admin: true });
  },

  getProperties: () => request<Property[]>("/properties"),
  getProperty: (id: string) => request<PropertyDetail>(`/properties/${id}`),
  getKpis: (propertyId: string, month?: string) =>
    request<Kpis>(`/dashboard/kpis?propertyId=${propertyId}${month ? `&month=${month}` : ""}`, { admin: true }),
  getMonthlyRevenue: (propertyId: string, year?: number) =>
    request<MonthlyRevenue>(
      `/dashboard/monthly-revenue?propertyId=${propertyId}${year ? `&year=${year}` : ""}`,
      { admin: true }
    ),
  getCalendar: (propertyId: string, from: string, to: string, admin = false) =>
    request<CalendarData>(`/calendar/${propertyId}?from=${from}&to=${to}`, { admin }),
  getReservations: (propertyId: string) =>
    request<Reservation[]>(`/reservations?propertyId=${propertyId}`, { admin: true }),
  getPricingRules: (propertyId: string) =>
    request<PricingRule[]>(`/pricing-rules?propertyId=${propertyId}`),
  createReservation: (data: CreateReservationInput, admin = false) =>
    request<Reservation>("/reservations", { method: "POST", body: JSON.stringify(data), admin }),
  deleteReservation: (id: string) =>
    request<{ success: boolean; emailSent?: boolean; emailError?: string }>(`/reservations/${id}`, {
      method: "DELETE",
      admin: true,
    }),
  updateReservationPricing: (
    id: string,
    data: { discountPercent?: number; totalPrice?: number }
  ) =>
    request<Reservation & { subtotalBeforeDiscount?: number }>(`/reservations/${id}`, {
      method: "PATCH",
      admin: true,
      body: JSON.stringify(data),
    }),
  validateReservation: (id: string) =>
    request<
      Reservation & {
        emailSent?: boolean;
        welcomeEmailSent?: boolean;
        welcomeEmailNote?: string;
      }
    >(`/reservations/${id}/validate`, { method: "POST", admin: true }),
  checkAvailability: (data: QuoteInput) =>
    request<AvailabilityResult>("/reservations/check-availability", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getQuote: (data: QuoteInput) =>
    request<PriceBreakdown>("/pricing/quote", { method: "POST", body: JSON.stringify(data) }),
  createPricingRule: (data: CreatePricingRuleInput) =>
    request<PricingRule>("/pricing-rules", { method: "POST", body: JSON.stringify(data), admin: true }),
  getBlocks: (propertyId: string) =>
    request<AvailabilityBlock[]>(`/blocks?propertyId=${propertyId}`, { admin: true }),
  createBlock: (data: CreateBlockInput) =>
    request<AvailabilityBlock>("/blocks", { method: "POST", body: JSON.stringify(data), admin: true }),
  deleteBlock: (id: string) =>
    request<{ success: boolean }>(`/blocks/${id}`, { method: "DELETE", admin: true }),
  syncGuests: () =>
    request<{ synced: number; uniqueEmails: number; total: number }>("/guests/sync", {
      method: "POST",
      admin: true,
    }),
  getGuests: (options?: { search?: string; marketingOnly?: boolean; sync?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.search?.trim()) params.set("search", options.search.trim());
    if (options?.marketingOnly) params.set("marketingOnly", "true");
    if (options?.sync) params.set("sync", "true");
    const query = params.toString();
    return request<Guest[]>(`/guests${query ? `?${query}` : ""}`, { admin: true });
  },
  updateGuest: (id: string, data: { marketingOptIn?: boolean; notes?: string | null }) =>
    request<Guest>(`/guests/${id}`, { method: "PATCH", admin: true, body: JSON.stringify(data) }),
  exportGuestsCsv: async (marketingOnly = false) => {
    const token = getAdminToken();
    const params = marketingOnly ? "?marketingOnly=true" : "";
    const response = await fetch(`${API_URL}/guests/export.csv${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error("Não foi possível exportar a lista de hóspedes");
    }

    return response.blob();
  },
};

export interface Property {
  id: string;
  name: string;
  slug: string;
  basePrice: string;
  currency: string;
  maxGuests: number;
  _count: { reservations: number };
}

export interface PropertyDetail extends Property {
  pricingRules: PricingRule[];
  blocks: AvailabilityBlock[];
}

export interface Reservation {
  id: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: string;
  discountPercent?: string | null;
  currency: string;
  status: string;
  notes?: string | null;
  validatedAt?: string | null;
  welcomeEmailSentAt?: string | null;
  createdAt?: string | null;
  accessCode?: string | null;
  emailSent?: boolean;
  subtotalBeforeDiscount?: number;
}

export interface AvailabilityBlock {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface CalendarData {
  from: string;
  to: string;
  reservations: Reservation[];
  blocks: AvailabilityBlock[];
}

export interface PricingRule {
  id: string;
  name: string;
  priority: number;
  modifier: string;
  modifierType: string;
  dayOfWeek: number | null;
  minNights: number | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

export interface Kpis {
  month: string;
  reservations: number;
  revenue: number;
  occupancyRate: number;
  bookedNights: number;
}

export interface MonthlyRevenueMonth {
  month: number;
  label: string;
  revenue: number;
  reservations: number;
}

export interface MonthlyRevenue {
  year: number;
  months: MonthlyRevenueMonth[];
  totalRevenue: number;
}

export interface PriceBreakdown {
  nights: { date: string; basePrice: number; guestSurcharge: number; adjustedPrice: number; appliedRules: string[] }[];
  subtotal: number;
  currency: string;
  guests: number;
}

export interface AvailabilityResult {
  available: boolean;
  conflicts: { type: string; label: string; startDate: string; endDate: string }[];
}

export interface CreateReservationInput {
  propertyId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  discountPercent?: number;
}

export interface QuoteInput {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}

export interface CreatePricingRuleInput {
  propertyId: string;
  name: string;
  priority: number;
  modifier: number;
  modifierType: "PERCENT" | "FIXED";
  dayOfWeek?: number;
  minNights?: number;
  startDate?: string;
  endDate?: string;
}

export interface CreateBlockInput {
  propertyId: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface Guest {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  stayCount: number;
  firstStayAt: string | null;
  lastStayAt: string | null;
  lastCheckOut: string | null;
  marketingOptIn: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
