// pages/admin.tsx
"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("No token found. Please log in first.");
      return;
    }

    fetch("http://127.0.0.1:8000/admin-only", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.detail || res.statusText);
        }
        return res.json();
      })
      .then((json) => setSecret(json.secret))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-lg mx-auto mt-16 p-6 border rounded">
      <h1 className="text-xl mb-4">/admin-only Endpoint</h1>
      {error && <p className="text-red-500">Error: {error}</p>}
      {secret && <p className="text-green-600">Secret: {secret}</p>}
    </div>
  );
}
