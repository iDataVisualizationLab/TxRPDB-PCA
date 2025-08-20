// hooks/useAuth.ts
export function useAuth() {
  if (typeof window === "undefined") return { isGuest: false, isLoggedIn: false, username: null };

  return {
    isGuest: localStorage.getItem("guest") === "true",
    isLoggedIn: !!localStorage.getItem("token"),
    username: localStorage.getItem("username"),
  };
}
