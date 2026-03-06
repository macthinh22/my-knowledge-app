const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function register(
  username: string,
  password: string,
): Promise<{ access_token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Registration failed");
  }
  const data = await res.json();
  accessToken = data.access_token;
  return data;
}

export async function login(
  username: string,
  password: string,
): Promise<{ access_token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Login failed");
  }
  const data = await res.json();
  accessToken = data.access_token;
  return data;
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      accessToken = null;
      return null;
    }
    const data = await res.json();
    accessToken = data.access_token;
    return data.access_token;
  } catch {
    accessToken = null;
    return null;
  }
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
  accessToken = null;
}

export async function authFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const doFetch = (token: string | null) =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
      credentials: "include",
    });

  let res = await doFetch(accessToken);

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  return res;
}
