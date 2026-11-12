/**
 * Device identity. DUWA has no e-mail/password in v1: a device proves who it
 * is with the secret token it received when it created / joined the room.
 * (Works inside embedded previews too — storage may be partitioned or blocked,
 * so every access is guarded and falls back to memory.)
 */
export interface Creds {
  /** player id */
  pid: string;
  /** device secret (never shown to the user) */
  token: string;
  /** room invite code */
  code: string;
  /** human recovery code, kept so Settings can show it again on this device */
  recovery?: string;
}

const KEY = "duwa:session";

/** undefined = storage not read yet. Kept in memory so the value survives blocked storage. */
let cached: Creds | null | undefined;
const listeners = new Set<() => void>();

function readStorage(): Creds | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Creds;
      if (parsed && typeof parsed.pid === "string" && typeof parsed.token === "string") return parsed;
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

function emit(): void {
  for (const fn of listeners) fn();
}

/** The identity stored on this device (same object until it changes). */
export function loadCreds(): Creds | null {
  if (typeof window === "undefined") return null;
  if (cached === undefined) cached = readStorage();
  return cached;
}

export function subscribeCreds(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function saveCreds(creds: Creds): void {
  cached = creds;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(creds));
  } catch {
    /* keep in memory only */
  }
  emit();
}

export function clearCreds(): void {
  cached = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  emit();
}

// Signing in or out in another tab of the same browser.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== null && e.key !== KEY) return;
    cached = readStorage();
    emit();
  });
}

export function authHeader(creds: Creds): Record<string, string> {
  return { Authorization: `Bearer ${creds.pid}.${creds.token}` };
}

/* --- room code helpers (shared with the entry screens) ---------------- */
export const CODE_LENGTH = 6;

/** Keep only characters that can appear in a room code. */
export function tidyCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

export function tidyRecovery(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function prettyRecovery(code: string): string {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
