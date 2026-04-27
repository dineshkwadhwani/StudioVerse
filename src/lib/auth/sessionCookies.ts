type SessionCookieInput = {
  uid: string;
  role: "company" | "professional" | "individual" | "superadmin";
};

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function setCookie(name: string, value: string, maxAgeSeconds = COOKIE_MAX_AGE_SECONDS): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function persistAuthSessionCookies(input: SessionCookieInput): void {
  setCookie("cs_uid", input.uid);
  setCookie("cs_role", input.role);
}

export function clearAuthSessionCookies(): void {
  clearCookie("cs_uid");
  clearCookie("cs_role");
}
