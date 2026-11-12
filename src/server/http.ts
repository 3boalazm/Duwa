import { GameError } from "@/game/types";
import type { ApiErrorBody } from "./contracts";
import { ConfigError } from "./db";

/** An expected failure with a message the player can read. */
export class ApiFail extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiFail";
  }
}

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export function ok<T>(data: T, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

export function fail(err: unknown): Response {
  let status = 500;
  let code = "server";
  let message = "حصلت مشكلة عندنا. جرّب تاني بعد لحظة.";
  if (err instanceof ApiFail) {
    ({ status, code, message } = err);
  } else if (err instanceof GameError) {
    status = 409;
    code = err.code;
    message = err.message;
  } else if (err instanceof ConfigError) {
    status = 503;
    code = "no_database";
    message = "قاعدة البيانات لسه مش متوصلة بالتطبيق.";
    console.error("[duwa] configuration:", err.message);
  } else {
    console.error("[duwa] unexpected error:", err);
  }
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status, headers: NO_STORE });
}

export async function readJson(req: Request, maxBytes = 64_000): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiFail(413, "too_large", "الطلب أكبر من المسموح.");
  try {
    const data: unknown = text ? JSON.parse(text) : {};
    if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new ApiFail(400, "bad_json", "الطلب مش مفهوم.");
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/* --- tiny fixed-window rate limiter (per server instance) --------------- */
const store = globalThis as unknown as { __duwaRate?: Map<string, { n: number; reset: number }> };
const buckets = (store.__duwaRate ??= new Map());

export function rateLimit(bucket: string, id: string, max: number, windowMs: number): void {
  const now = Date.now();
  const key = `${bucket}:${id}`;
  const cur = buckets.get(key);
  if (!cur || cur.reset <= now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    return;
  }
  cur.n += 1;
  if (cur.n > max) throw new ApiFail(429, "slow_down", "محاولات كتير ورا بعض. استنى شوية وجرّب تاني.");
}
