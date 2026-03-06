"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getAccessToken,
  logout as authLogout,
  refreshAccessToken,
} from "@/lib/auth";

interface AuthContextValue {
  authenticated: boolean;
  loading: boolean;
  username: string | null;
  logout: () => Promise<void>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const AuthContext = createContext<AuthContextValue>({
  authenticated: false,
  loading: true,
  username: null,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ["/login", "/register"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsername(token: string): Promise<string | null> {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!res.ok) {
          return null;
        }
        const data = await res.json();
        return typeof data?.username === "string" ? data.username : null;
      } catch {
        return null;
      }
    }

    async function init() {
      if (PUBLIC_PATHS.includes(pathname)) {
        setLoading(false);
        return;
      }

      let token = getAccessToken();
      if (!token) {
        token = await refreshAccessToken();
      }

      if (token) {
        setAuthenticated(true);
        setUsername(await fetchUsername(token));
      } else {
        setAuthenticated(false);
        setUsername(null);
        router.replace("/login");
      }

      setLoading(false);
    }

    void init();
  }, [pathname, router]);

  const handleLogout = useCallback(async () => {
    await authLogout();
    setAuthenticated(false);
    setUsername(null);
    router.replace("/login");
  }, [router]);

  if (loading && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!authenticated && !PUBLIC_PATHS.includes(pathname)) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{ authenticated, loading, username, logout: handleLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
