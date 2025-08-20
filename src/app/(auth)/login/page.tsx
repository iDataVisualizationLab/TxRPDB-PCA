"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { loginUser, resendActivationEmail } from "@/lib/api/users";
import {getFrontendBaseUrl} from "@/config";

export default function LoginPage() {
  const router = useRouter();
  // const pathname = usePathname();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // const frontendBaseUrl = useMemo(() => {
  //   if (typeof window === "undefined") return "";
  //   return getFrontendBaseUrl()
  // }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendSuccess(null);
    setShowResend(false);
    setLoading(true);

    try {
      const data = await loginUser(identifier, password);
      const { access_token, refresh_token, email, username, role } = data;

      localStorage.setItem("token", access_token);
      localStorage.setItem("email", email);
      localStorage.setItem("username", username);
      localStorage.setItem("role", role);
      localStorage.setItem("guest", "false");
      sessionStorage.setItem("refresh_token", refresh_token);

      router.push("/");
    } catch (err: any) {

      if (err?.detail) {

        if (err.detail.toLowerCase().includes("not activated")) {
          setShowResend(true);
        }
        if (Array.isArray(err.detail)) {
          setError(err.detail.map((e: any) => e.msg).join(", "));
        } else if (typeof err.detail === "string") {
          setError(err.detail);
        } else if (typeof err.detail?.msg === "string") {
          setError(err.detail.msg);
        } else {
          setError("Login failed");
        }
      } else {
        if (err.message.toLowerCase().includes("not activated")) {
          setShowResend(true);
        }
        setError(err.message || "Login failed");
      }
      localStorage.setItem("guest", "true");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResendSuccess(null);
    try {
      const res = await resendActivationEmail(identifier, getFrontendBaseUrl());
      setResendSuccess(res.msg || "Activation email resent.");
      setShowResend(false);
    } catch (err: any) {
      if (err?.detail) {
        if (Array.isArray(err.detail)) {
          setError(err.detail.map((e: any) => e.msg).join(", "));
        } else if (typeof err.detail === "string") {
          setError(err.detail);
        } else if (typeof err.detail?.msg === "string") {
          setError(err.detail.msg);
        } else {
          setError("Could not resend activation email.");
        }
      } else {
        setError(err.message || "Could not resend activation email.");
      }
    } finally {
      setShowResend(false);
    }
  }

  function handleContinueAsGuest() {
    localStorage.setItem("guest", "true");
    localStorage.removeItem("token");
    sessionStorage.removeItem("refresh_token");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    localStorage.setItem("role", "guest");
    router.push("/level_one_sections/");
  }

  return (
    <div className="w-full max-w-xl mx-auto mt-24 px-10 py-12 bg-white rounded-2xl shadow-lg">
      <h1 className="text-3xl font-semibold mb-6 text-center">Log In</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-red-500 text-sm">
            {error}
            {showResend && (
              <>
                {" "}
                Didn&#39;t get the email?{" "}
                <button
                  onClick={handleResend}
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Resend Activation Email
                </button>
              </>
            )}
          </p>
        )}

        {resendSuccess && <p className="text-green-600 text-sm">{resendSuccess}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email or Username
          </label>
          <input
            type="text"
            required
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 transition"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>


      <div className="mt-6 text-center space-y-4">
        <p className="text-gray-600">Or</p>
        <button
          type="button"
          onClick={handleContinueAsGuest}
          className="w-full bg-gray-500 text-white py-2 rounded-md hover:bg-gray-600 transition"
        >
          Continue as Guest
        </button>

        <p className="text-sm text-gray-700">
          Don’t have an account?{" "}
          <a
            onClick={(e) => {
              e.preventDefault();
              router.push('/register');
            }}
            // href="register"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Register here
          </a>
        </p>
      </div>
    </div>
  );
}
