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
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((res) => handleResponse<T>(res));
}

export const fetchJson = <T>(path: string) => request<T>("GET", path);
export const postJson = <T>(path: string, body: unknown) => request<T>("POST", path, body);
export const putJson = <T>(path: string, body: unknown) => request<T>("PUT", path, body);
export const deleteJson = (path: string) => request<void>("DELETE", path);
