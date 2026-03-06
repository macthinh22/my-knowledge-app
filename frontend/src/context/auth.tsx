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
    async function init() {
      if (PUBLIC_PATHS.includes(pathname)) {
        setLoading(false);
        return;
      }

      const existing = getAccessToken();
      if (existing) {
        setAuthenticated(true);
        setLoading(false);
        return;
      }

      const token = await refreshAccessToken();
      if (token) {
        setAuthenticated(true);
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/auth/me`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (res.ok) {
            const data = await res.json();
            setUsername(data.username);
          }
        } catch {
          setUsername(null);
        }
      } else {
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

  return (
    <AuthContext.Provider
      value={{ authenticated, loading, username, logout: handleLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
