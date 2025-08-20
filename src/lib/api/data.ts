import { API_BASE, handleResponse } from "./index";
import { authFetch } from "./auth";

export async function fetchProxy<T = any>(path: string): Promise<T> {
  const res = await fetch(
    `${API_BASE}/get-proxy?path=${encodeURIComponent(path)}`,
    { next: { revalidate: 60 } }
  );
  return handleResponse(res);
}


export async function saveToBackend(path: string, payload: unknown): Promise<void> {
  const url = `${API_BASE}/post-proxy?path=${encodeURIComponent(path)}`;
  const res = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function uploadProxy(path: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("path", path);

  const res = await authFetch(`${API_BASE}/upload-proxy`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}


export async function deleteFromBackend(path: string): Promise<void> {
  const url = `${API_BASE}/delete-proxy?path=${encodeURIComponent(path)}`;
  const res = await authFetch(url, { method: 'DELETE' });
  return handleResponse(res);
}

export async function uploadReport(file: File | null, link: string | null, basePath: string): Promise<{ imagePath: string; pdfPath: string }> {
  const formData = new FormData();
  if (file) formData.append("file", file);
  if (link) formData.append("link", link);
  formData.append("basePath", basePath);

  const res = await authFetch(`${API_BASE}/upload-report`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}