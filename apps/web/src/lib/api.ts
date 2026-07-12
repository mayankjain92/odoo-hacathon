const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("af_access_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let body: { message?: string; code?: string; details?: unknown } = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiClientError(
      body.message ?? res.statusText,
      res.status,
      body.code,
      body.details,
    );
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json();

  // If this was a login or signup request, save the token if present
  if (typeof window !== "undefined" && (path === "/auth/login" || path === "/auth/signup")) {
    const accessToken = data.tokens?.accessToken || data.token;
    if (accessToken) {
      localStorage.setItem("af_access_token", accessToken);
    }
  }

  // If this was a logout request, clear the token
  if (typeof window !== "undefined" && path === "/auth/logout") {
    localStorage.removeItem("af_access_token");
  }

  // Handle compatibility if response contains { user, tokens } but the caller expects only the user
  if (data && typeof data === "object" && "user" in data && ("tokens" in data || "token" in data)) {
    return data.user as T;
  }

  return data as T;
}
