export * from "./data";
export * from "./users";


export const API_BASE = process.env.API_BASE_URL!;
export const API_GET_PROXY = `${API_BASE}/get-proxy?path=`
export async function handleResponse<T = any>(res: Response): Promise<T> {
  const json = await res.json();

  if (!res.ok) {
    const error = new Error(json?.detail || "Request failed");
    (error as any).detail = json?.detail || json;
    throw error;
  }

  return json.data || json;
}

export function buildAuthHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = localStorage.getItem("token");
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}