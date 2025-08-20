"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { refreshToken } from '@/lib/api/';
import { SIDENAV_ITEMS } from "@/components/nav/constants";

interface JWT {
  exp: number;
}

function isTokenExpired(token: string): boolean {
  try {
    const decoded: JWT = jwtDecode(token);
    const now = Date.now() / 1000;
    // console.log("Token expiration time:", decoded.exp, "Current time:", now);
    return decoded.exp < now;
  } catch {
    return true; // Invalid token
  }
}

function isTokenExpiringSoon(token: string, withinSeconds = 60): boolean {
  try {
    const decoded: JWT = jwtDecode(token);
    const now = Date.now() / 1000;
    // console.log("Token expiration time:", decoded.exp, "Current time:", now, "Within seconds:", withinSeconds);
    return decoded.exp - now <= withinSeconds;
  } catch {
    return true;
  }
}

function flattenNavItems(items: any[]): any[] {
  return items.flatMap(item => {
    if (item.subMenuItems) {
      return [item, ...flattenNavItems(item.subMenuItems)];
    }
    return [item];
  });
}


export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const checkAuthorization = () => {
    const guest = localStorage.getItem("guest");
    const role = localStorage.getItem("role") ?? (guest ? "guest" : "none");
    const allRoutes = flattenNavItems(SIDENAV_ITEMS);
    const matched = allRoutes.find(item => pathname?.startsWith(item.path));
    if (matched && !matched.allowedRoles.includes(role)) {
      if (role === "guest") {
        router.replace("/login/");
        setAuthorized(true);
      } else {
        router.replace("/login");
        setAuthorized(false);
      }
    } else {
      setAuthorized(true);
    }
  };
  useEffect(() => {
    const checkAccess = async () => {

      const token = localStorage.getItem("token") || null;
      const role = localStorage.getItem("role") || "none";
      const isGuest = localStorage.getItem("guest") === "true";

      const hasToken = !!token;
      const expired = hasToken ? isTokenExpired(token) : true;
      const expiringSoon = hasToken ? isTokenExpiringSoon(token, 120) : false;
      // Admin/User without a valid token → login
      if ((!hasToken || expired) && !isGuest) {
        localStorage.removeItem("token");
        localStorage.removeItem("role"); 
        localStorage.removeItem("guest");
        router.replace("/login");
        setAuthorized(false);
        return;
      }


      // Token exists but is expiring soon → refresh
      if (hasToken && (expired || expiringSoon)) {
        if (refreshing) return;
        setRefreshing(true);
        try {
          const res = await refreshToken();
          localStorage.setItem("token", res.access_token);
          checkAuthorization();
          setAuthorized(true);
        } catch {
          localStorage.removeItem("token");
          router.replace("/login");
          setAuthorized(false);
        } finally {
          setRefreshing(false);
        }
        return;
      }
      // Guest or valid token
      checkAuthorization();
    };
    checkAccess();
    const interval = setInterval(checkAccess, 1 * 60 * 1000); // Every 1 minute
    return () => clearInterval(interval);

  }, [router, pathname, refreshing]);

  if (authorized === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span>Loading…</span>
      </div>
    );
  }

  if (authorized === false) {
    return null;
  }

  return <>{children}</>;
}