"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { registerUser } from "@/lib/api";
import {getFrontendBaseUrl} from "@/config";

function SuccessModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4 text-green-700">Success</h2>
        <p className="text-gray-700 mb-6">{message}</p>
        <button
          onClick={onClose}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
        >
          OK
        </button>
      </div>
    </div>
  );
}

function isAllowedEmail(email: string): boolean {
  const allowedDomains = ["@txdot.gov", "@ttu.edu"];
  return allowedDomains.some(domain => email.toLowerCase().endsWith(domain));
}

export default function RegisterPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // const frontendBaseUrl = useMemo(() => {
  //   if (typeof window === "undefined") return "";
  //   console.log(window.location.href.replace(pathname, ""))
  //   console.log(pathname)
  //   console.log(window.location.href)
  //   return window.location.href.replace(pathname, "");
  // }, [pathname]);

  const isPasswordTooShort = password.length > 0 && password.length < 6;
  const doPasswordsMismatch = confirmPassword && password !== confirmPassword;
  const isFormValid = email && username && password.length >= 6 && password === confirmPassword;

  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (isPasswordTooShort) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (doPasswordsMismatch) {
      setError("Passwords do not match");
      return;
    }

    if (!isAllowedEmail(email)) {
      setError("Only @txdot.gov or @ttu.edu email addresses are allowed.");
      return;
    }

    setLoading(true);
    try {
      const { msg } = await registerUser(email, username, password, getFrontendBaseUrl());
      setSuccess(msg || "Registered! Please check your email to activate your account. This may take 3–5 minutes to arrive.");
      setEmail(""); setUsername(""); setPassword(""); setConfirmPassword("");
    } catch (err: any) {
      if (err?.detail) {
        if (Array.isArray(err.detail)) {
          setError(err.detail.map((e: any) => e.msg).join(", "));
        } else if (typeof err.detail === "string") {
          setError(err.detail);
        } else if (typeof err.detail?.msg === "string") {
          setError(err.detail.msg);
        } else {
          setError("Registration failed");
        }
      } else {
        setError(err.message || "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  }, [email, username, password, confirmPassword, isPasswordTooShort, doPasswordsMismatch]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
        router.push("/login");
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  return (
    <>
      <div className="w-full max-w-xl mx-auto mt-24 px-10 py-12 bg-white rounded-2xl shadow-lg">
        <h1 className="text-3xl font-semibold mb-6 text-center">Register</h1>
        <form onSubmit={handleRegister} className="space-y-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => {
                const val = e.target.value;
                setEmail(val);
                if (val && !isAllowedEmail(val)) {
                  setEmailError("Only @txdot.gov or @ttu.edu addresses are allowed.");
                } else {
                  setEmailError(null);
                }
              }}
              required
              className={`mt-1 w-full border ${
                emailError ? "border-red-500" : "border-gray-300"
              } rounded-md px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {emailError && (
              <p className="text-red-500 text-sm mt-1">{emailError}</p>
            )}
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isPasswordTooShort && (
              <p className="text-red-500 text-sm mt-1">Password must be at least 6 characters</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {doPasswordsMismatch && (
              <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 transition disabled:opacity-50"
            disabled={loading || !isFormValid}
          >
            {loading ? "Registering..." : "Register"}
          </button>

          <p className="text-sm mt-6 text-center text-gray-700">
            Already have an account?{" "}
            <a 
            onClick={(e) => {
              e.preventDefault();
              router.push('/login');
            }}
            // href="login" 
            className="text-blue-600 underline hover:text-blue-800">
              Log in
            </a>
          </p>
        </form>
      </div>

      {success && (
        <SuccessModal
          message={success}
          onClose={() => {
            setSuccess(null);
            router.push("/login");
          }}
        />
      )}
    </>
  );
}
