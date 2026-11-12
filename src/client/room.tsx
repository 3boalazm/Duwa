"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gx } from "@/game/profile";
import type { ActResponse, ClientAction, RoomView, SyncResponse } from "@/server/contracts";
import { api, ApiError } from "./api";
import { useCreds, useTick } from "./hooks";
import { clearCreds, type Creds, loadCreds, saveCreds } from "./session";

/* ------------------------------------------------------------------ */
/*  context                                                             */
/* ------------------------------------------------------------------ */
export type ToastTone = "info" | "good" | "bad";
interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

interface RoomContextValue {
  view: RoomView | null;
  /** live = talking to the server · reconnecting = the network dropped */
  status: "loading" | "live" | "reconnecting";
  creds: Creds | null;
  /** server clock in epoch ms — both phones count down from the same time */
  now: () => number;
  /** how far the server clock is ahead of this device's clock, in ms */
  skew: () => number;
  act: (action: ClientAction) => Promise<ActResponse>;
  toast: (text: string, tone?: ToastTone) => void;
  /** forget this device's identity (the seat itself is kept on the server) */
  signOut: () => void;
  updateCreds: (patch: Partial<Creds>) => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used inside <RoomProvider>");
  return ctx;
}

/** Convenience for screens that only render once the room is loaded. */
export function useRoomView(): RoomView {
  const { view } = useRoom();
  if (!view) throw new Error("room view not loaded");
  return view;
}

/* ------------------------------------------------------------------ */
/*  provider                                                            */
/* ------------------------------------------------------------------ */
/** Stop polling when nobody is looking, so an idle tab never keeps the database awake. */
const IDLE_AFTER_MS = 5 * 60_000;
const HIDDEN_GRACE_MS = 60_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isLive(view: RoomView | null): boolean {
  const phase = view?.session?.phase;
  return phase === "countdown" || phase === "play" || phase === "reveal";
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const creds = useCreds();
  const identity = creds ? `${creds.pid}.${creds.token}` : null;
  const [view, setView] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<RoomContextValue["status"]>("loading");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const viewRef = useRef<RoomView | null>(null);
  const versionRef = useRef(0);
  const offsetRef = useRef(0);
  const offsetSamples = useRef<number[]>([]);
  const lastActiveRef = useRef(0);
  const hiddenAtRef = useRef<number | null>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const toastId = useRef(0);
  const seenFlash = useRef<string | null>(null);

  const now = useCallback(() => Date.now() + offsetRef.current, []);
  const skew = useCallback(() => offsetRef.current, []);

  const toast = useCallback((text: string, tone: ToastTone = "info") => {
    const id = ++toastId.current;
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3800);
  }, []);

  /** Apply a server response (from a poll or from an action). */
  const apply = useCallback((res: SyncResponse) => {
    // Clock offset: the freshest (largest) recent sample has the least network delay in it.
    const sample = res.now - Date.now();
    offsetSamples.current = [...offsetSamples.current.slice(-5), sample];
    offsetRef.current = Math.max(...offsetSamples.current);

    if (res.view) {
      if (res.v < versionRef.current) return; // an older answer arrived late
      versionRef.current = res.v;
      viewRef.current = res.view;
      setView(res.view);
    } else if (res.partnerOnline !== undefined) {
      const cur = viewRef.current;
      if (cur?.partner && cur.partner.online !== res.partnerOnline) {
        const next = { ...cur, partner: { ...cur.partner, online: res.partnerOnline } };
        viewRef.current = next;
        setView(next);
      }
    }
  }, []);

  const signOut = useCallback(() => {
    clearCreds();
    setView(null);
    viewRef.current = null;
    versionRef.current = 0;
    router.replace("/");
  }, [router]);

  const updateCreds = useCallback((patch: Partial<Creds>) => {
    const cur = loadCreds();
    if (cur) saveCreds({ ...cur, ...patch });
  }, []);

  const act = useCallback(
    async (action: ClientAction) => {
      const c = loadCreds();
      if (!c) throw new ApiError(401, "unauthorized", "ادخل الغرفة من جديد.");
      lastActiveRef.current = Date.now();
      try {
        const res = await api<ActResponse>("/api/act", { method: "POST", body: action, creds: c });
        if (!res.gone) apply(res);
        return res;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.code === "room_gone")) signOut();
        throw err;
      }
    },
    [apply, signOut],
  );

  /* --- identity ------------------------------------------------------ */
  useEffect(() => {
    // Read the device directly: while hydrating, `identity` is still empty.
    if (!loadCreds()) router.replace("/");
  }, [router, identity]);

  /* --- long-poll loop ------------------------------------------------- */
  useEffect(() => {
    if (!identity) return;
    let stopped = false;
    const controller = new AbortController();
    lastActiveRef.current = Date.now();

    const shouldRun = () => {
      if (isLive(viewRef.current)) return true;
      if (document.hidden) return hiddenAtRef.current !== null && Date.now() - hiddenAtRef.current < HIDDEN_GRACE_MS;
      return Date.now() - lastActiveRef.current < IDLE_AFTER_MS;
    };

    const sayBye = () => {
      const c = loadCreds();
      if (!c) return;
      try {
        navigator.sendBeacon?.("/api/bye", new Blob([JSON.stringify({ pid: c.pid, token: c.token })], { type: "application/json" }));
      } catch {
        /* best effort */
      }
    };

    const loop = async () => {
      let failures = 0;
      let resting = false;
      while (!stopped) {
        if (!shouldRun()) {
          if (!resting) {
            resting = true;
            sayBye();
          }
          await new Promise<void>((resolve) => {
            wakeRef.current = resolve;
            setTimeout(resolve, 20_000);
          });
          wakeRef.current = null;
          continue;
        }
        resting = false;
        try {
          const res = await api<SyncResponse>(`/api/sync?v=${versionRef.current}`, {
            creds: loadCreds(),
            signal: controller.signal,
          });
          if (stopped) return;
          failures = 0;
          setStatus("live");
          apply(res);
        } catch (err) {
          if (stopped || (err as Error)?.name === "AbortError") return;
          if (err instanceof ApiError && (err.status === 401 || err.code === "room_gone")) {
            signOut();
            return;
          }
          failures += 1;
          if (failures >= 2) setStatus("reconnecting");
          await sleep(Math.min(5000, 400 * 2 ** failures));
        }
      }
    };

    const wake = () => {
      lastActiveRef.current = Date.now();
      wakeRef.current?.();
    };
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else {
        hiddenAtRef.current = null;
        wake();
      }
    };
    const onPageHide = () => sayBye();

    window.addEventListener("pointerdown", wake, { passive: true });
    window.addEventListener("keydown", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    void loop();

    return () => {
      stopped = true;
      controller.abort();
      wakeRef.current?.();
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [identity, apply, signOut]);

  /* --- keep the invite code on this device in step with the room ------- */
  useEffect(() => {
    if (view && creds && creds.code !== view.code) updateCreds({ code: view.code });
  }, [view, creds, updateCreds]);

  /* --- routing rules ---------------------------------------------------- */
  useEffect(() => {
    if (!view) return;
    const s = view.session;
    const live = isLive(view);
    const hostWaiting = s?.phase === "invite" && s.host === view.me.seat;
    if (!view.partner) {
      // Alone in the room: only the invite screen and settings make sense.
      if (pathname !== "/lobby" && pathname !== "/settings") router.replace("/lobby");
      return;
    }
    if ((live || hostWaiting) && pathname !== "/play") {
      router.replace("/play");
      return;
    }
    if (pathname === "/play" && !s) router.replace("/home");
  }, [view, pathname, router]);

  /* --- one-off notices from the other player ------------------------------ */
  useEffect(() => {
    const f = view?.flash;
    if (!f || !view) return;
    if (seenFlash.current === null) {
      seenFlash.current = f.id; // whatever was there when we loaded is old news
      if (now() - f.at > 8000) return;
    } else if (seenFlash.current === f.id) {
      return;
    }
    seenFlash.current = f.id;
    if (f.by === view.me.seat || now() - f.at > 15_000) return;
    const p = view.partner;
    const name = p?.name ?? "اللاعب التاني";
    const text = {
      declined: `${name} ${gx(p, "مش فاضي", "مش فاضية")} دلوقتي. جرّبوا بعد شوية.`,
      cancelled: `${name} ${gx(p, "لغى", "لغت")} الدعوة.`,
      quit: `${name} ${gx(p, "خرج", "خرجت")} من الجولة.`,
      joined: `${name} ${gx(p, "دخل", "دخلت")} الغرفة!`,
      left: "اللاعب التاني ساب الغرفة.",
    }[f.kind];
    toast(text, f.kind === "joined" ? "good" : "info");
  }, [view, now, toast]);

  const value = useMemo<RoomContextValue>(
    () => ({ view, status, creds, now, skew, act, toast, signOut, updateCreds }),
    [view, status, creds, now, skew, act, toast, signOut, updateCreds],
  );

  return (
    <RoomContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex w-full max-w-[460px] flex-col items-center gap-2 px-5"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-rise rounded-2xl border px-4 py-2.5 text-center text-[14px] font-medium shadow-[0_14px_40px_-12px_rgb(0_0_0/0.8)] backdrop-blur ${
              t.tone === "good"
                ? "border-mint/40 bg-[#0f2a26]/95 text-mint"
                : t.tone === "bad"
                  ? "border-rose/40 bg-[#2a1220]/95 text-rose"
                  : "border-line-2 bg-navy-2/95 text-cloud"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </RoomContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  hooks                                                               */
/* ------------------------------------------------------------------ */
/** Milliseconds left until `endsAt` on the shared server clock (re-renders ~10×/s). */
export function useCountdown(endsAt: number | null | undefined): number {
  const { skew } = useRoom();
  const tick = useTick(!!endsAt);
  return endsAt ? Math.max(0, endsAt - (tick + skew())) : 0;
}
