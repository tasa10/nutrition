import { authEnabled, getIdToken } from "./firebase";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // レスポンスがJSONでない場合はステータスのみ
    }
    if (res.status === 401 && authEnabled && !window.location.pathname.startsWith("/login")) {
      // The session is gone (signed out elsewhere, token rejected): go back to the login screen.
      window.location.assign(new URL("/login/", window.location.origin).toString());
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = await getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export const fetchJson = <T>(path: string) => request<T>("GET", path);
export const postJson = <T>(path: string, body: unknown) => request<T>("POST", path, body);
export const putJson = <T>(path: string, body: unknown) => request<T>("PUT", path, body);
export const deleteJson = (path: string) => request<void>("DELETE", path);
