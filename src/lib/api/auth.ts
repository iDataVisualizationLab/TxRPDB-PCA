// lib/api/auth.ts
import { refreshToken as doRefreshToken } from './users'; // your function below
import { jwtDecode } from 'jwt-decode';

type JWT = { exp: number };

function isTokenExpiringSoon(token: string, withinSec = 60) {
  try {
    const { exp } = jwtDecode<JWT>(token);
    const now = Date.now() / 1000;
    return exp - now <= withinSec;
  } catch {
    return true;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function getFreshAccessToken(): Promise<string | null> {
  const token = localStorage.getItem('token');
  const rt = sessionStorage.getItem('refresh_token');

  // If we have a token that isn't expiring soon, use it
  if (token && !isTokenExpiringSoon(token, 30)) return token;

  // If we can refresh, do it (de-duped)
  if (rt) {
    if (!refreshInFlight) {
      refreshInFlight = doRefreshToken()
        .then(res => {
          const newAccess = res.access_token;
          if (newAccess) localStorage.setItem('token', newAccess);
          // if ((res as any).refresh_token) sessionStorage.setItem('refresh_token', (res as any).refresh_token);
          return newAccess ?? null;
        })
        .catch(() => {
          localStorage.removeItem('token');
          sessionStorage.removeItem('refresh_token');
          return null;
        })
        .finally(() => { refreshInFlight = null; });
    }
    return await refreshInFlight;
  }

  // No token and no refresh token
  return token ?? null;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  // 1) Ensure we have a fresh token (refresh first if needed)
  const token1 = await getFreshAccessToken();

  const headers = new Headers(init.headers || {});
  if (token1) headers.set('Authorization', `Bearer ${token1}`);

  let res = await fetch(input, { ...init, headers });

  // 2) If unauthorized, try a refresh once and retry
  if (res.status === 401) {
    const token2 = await getFreshAccessToken();
    if (!token2) {
      // No luck → go to login
      try { window.location.assign('/login'); } catch {}
      return res;
    }
    headers.set('Authorization', `Bearer ${token2}`);
    res = await fetch(input, { ...init, headers });
  }

  // 3) Return response (call handleResponse outside)
  return res;
}
