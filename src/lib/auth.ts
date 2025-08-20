// lib/auth.ts
export function isGuest(): boolean {
  return typeof window !== "undefined" && localStorage.getItem("guest") === "true";
}

export function isLoggedIn(): boolean {
  return typeof window !== "undefined" && !!localStorage.getItem("token");
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("email");
  localStorage.removeItem("role");
  localStorage.removeItem("guest");
  sessionStorage.removeItem("refresh_token");
}
