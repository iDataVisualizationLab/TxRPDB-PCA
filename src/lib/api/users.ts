import { API_BASE, handleResponse } from "./index";

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  email: string;
  username: string;
  role: string;
};

export async function loginUser(
  username: string,
  password: string
): Promise<LoginResponse> {
  const body = new URLSearchParams();
  body.append("username", username);
  body.append("password", password);

  const res = await fetch(`${API_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  return handleResponse(res);
}

export async function fetchMe(token: string): Promise<any> {
  const res = await fetch(`${API_BASE}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(res);
}

export async function logoutUser(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/logout`, {
      method: "POST",
      credentials: "include", // include cookie
    });

    return handleResponse(res);
  } catch (err) {
    // Not critical—ignore or log
    console.warn("Logout request failed:", err);
  }
}


export async function registerUser(
  email: string,
  username: string,
  password: string,
  frontendUrl: string
): Promise<{ msg: string }> {
  const body = new URLSearchParams();
  body.append("email", email);
  body.append("username", username);
  body.append("password", password);
  body.append("frontend_url", frontendUrl);

  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  return handleResponse(res);
}


export async function activateUser(token: string): Promise<{ msg: string }> {
  const res = await fetch(`${API_BASE}/activate?token=${encodeURIComponent(token)}`, {
    method: "GET",
  });

  return handleResponse(res);
}


export async function resendActivationEmail(
  identifier: string,
  frontendUrl: string
): Promise<{ msg: string }> {
  const body = new URLSearchParams();
  body.append("identifier", identifier);
  body.append("frontend_url", frontendUrl);

  const res = await fetch(`${API_BASE}/resend-activation`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  return handleResponse(res);
}

export async function refreshToken(): Promise<{ access_token: string; refresh_token?: string }> {
  const rt = sessionStorage.getItem("refresh_token");
  if (!rt) throw new Error("No refresh token available");

  const res = await fetch(`${API_BASE}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
  });
  const data = await handleResponse<{ access_token: string; refresh_token?: string }>(res);

  // if (data.refresh_token) sessionStorage.setItem('refresh_token', data.refresh_token);

  return data;
}