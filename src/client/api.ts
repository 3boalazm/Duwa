import { authHeader, type Creds } from "./session";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions {
  method?: "GET" | "POST";
  body?: unknown;
  creds?: Creds | null;
  signal?: AbortSignal;
}

const OFFLINE_MESSAGE = "مفيش اتصال بالإنترنت دلوقتي. جرّب تاني.";

/** Same-origin JSON call. Always relative: the browser is never the sandbox. */
export async function api<T>(path: string, { method = "GET", body, creds, signal }: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      signal,
      cache: "no-store",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(creds ? authHeader(creds) : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "network", OFFLINE_MESSAGE);
  }
  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? "server", e?.message ?? "حصلت مشكلة غير متوقعة. جرّب تاني.");
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "حصلت مشكلة غير متوقعة. جرّب تاني.";
}
