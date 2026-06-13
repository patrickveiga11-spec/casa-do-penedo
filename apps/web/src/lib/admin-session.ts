const STORAGE_KEY = "casa_admin_token";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setAdminToken(token: string) {
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function clearAdminToken() {
  sessionStorage.removeItem(STORAGE_KEY);
}
