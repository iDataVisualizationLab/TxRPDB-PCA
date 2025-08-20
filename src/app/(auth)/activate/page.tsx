"use client";
export const dynamic = "force-dynamic";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { activateUser } from "@/lib/api";
import { resendActivationEmail } from "@/lib/api";
import {getFrontendBaseUrl} from "@/config";

export default function ActivatePage() {
    // const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    // const token = searchParams.get("token");
    // const emailFromUrl = searchParams.get("email") || "";

    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");
    const [showResend, setShowResend] = useState(false);
    // const [email, setEmail] = useState(emailFromUrl);
    const [token, setToken] = useState<string | null>(null);
    const [emailFromUrl, setEmailFromUrl] = useState<string>("");
    const [email, setEmail] = useState("");
    const [resendSuccess, setResendSuccess] = useState<string | null>(null);
    const [resendError, setResendError] = useState<string | null>(null);

 useEffect(() => {
        if (typeof window === "undefined") return;

        const url = new URL(window.location.href);
        const tokenParam = url.searchParams.get("token");
        const emailParam = url.searchParams.get("email") || "";

        setToken(tokenParam);
        setEmailFromUrl(emailParam);
        setEmail(emailParam);

        if (!tokenParam) {
            setStatus("error");
            setMessage("No activation token provided.");
            return;
        }

        async function doActivate() {
            try {
                const { msg } = await activateUser(tokenParam as string);
                setStatus("success");
                setMessage(msg || "Your account has been activated!");
                setTimeout(() => router.push("/login"), 5000);
            } catch (err: any) {
                setStatus("error");
                const msg = err.message || "Activation failed";
                setMessage(msg);

                if (msg.toLowerCase().includes("expired")) {
                    setShowResend(true);
                }
            }
        }

        doActivate();
    }, [router]);
    
    // const frontendBaseUrl = useMemo(() => {
    //     if (typeof window === "undefined") return "";
    //     return window.location.href.replace(pathname, "");
    // }, [pathname]);

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("No activation token provided.");
            return;
        }

        async function doActivate() {
            try {
                const { msg } = await activateUser(token as string);
                setStatus("success");
                setMessage(msg || "Your account has been activated!");
                setTimeout(() => router.push("/login"), 5000);
            } catch (err: any) {
                setStatus("error");
                const msg = err.message || "Activation failed";
                setMessage(msg);

                if (msg.toLowerCase().includes("expired")) {
                    setShowResend(true);
                }
            }
        }

        doActivate();
    }, [token, router]);

    async function handleResend() {
        setResendSuccess(null);
        setResendError(null);
        try {
            const res = await resendActivationEmail(email, getFrontendBaseUrl());
            setResendSuccess(res.msg || "Activation email resent!");
        } catch (err: any) {
            if (err?.detail) {
                if (Array.isArray(err.detail)) {
                    setResendError(err.detail.map((e: any) => e.msg).join(", "));
                } else if (typeof err.detail === "string") {
                    setResendError(err.detail);
                } else if (typeof err.detail?.msg === "string") {
                    setResendError(err.detail.msg);
                } else {
                    setResendError("Error resending activation.");
                }
            } else {
                setResendError(err.message || "Error resending activation.");
            }
        }
    }

    return (
        <div className="w-full max-w-md mx-auto mt-32 p-8 bg-white shadow-lg rounded-xl text-center">
            {status === "loading" && (
                <p className="text-blue-600">Activating your account...</p>
            )}

            {status !== "loading" && (
                <>
                    <p
                        className={`font-medium ${status === "success" ? "text-green-600" : "text-red-600"
                            }`}
                    >
                        {message}
                    </p>

                    {status === "error" && showResend && (
                        <div className="mt-4 space-y-3">
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleResend}
                                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
                            >
                                Resend Activation Email
                            </button>
                            {resendSuccess && <p className="text-green-600 text-sm">{resendSuccess}</p>}
                            {resendError && <p className="text-red-500 text-sm">{resendError}</p>}
                        </div>
                    )}

                    <button
                        onClick={() => router.push("/login")}
                        className="mt-6 inline-block text-blue-600 hover:underline font-medium text-sm"
                    >
                        Go to Login now
                    </button>
                </>
            )}
        </div>
    );
}
