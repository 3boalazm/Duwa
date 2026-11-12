"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Trash2, Undo2 } from "lucide-react";
import { api, ApiError } from "@/client/api";
import { useRoom } from "@/client/room";
import { cn } from "@/lib/cn";
import type { DrawResponse } from "@/server/contracts";

/**
 * Shared drawing surface for «خمن الرسمة».
 *
 * Coordinates are stored on a 0–1000 grid so the drawing looks the same on
 * both phones whatever their screen size. The artist sends small batches of
 * operations; the guesser replays them as they arrive.
 */
interface Stroke {
  id: number;
  c: number;
  w: number;
  p: number[];
}
type Op = { k: "s"; id: number; c: number; w: number; p: number[] } | { k: "u" } | { k: "c" };

const BOARD = "#100d24";
const PALETTE = ["#F2F0FA", "#9B78FF", "#FF6FB1", "#FFC24B", "#3DDC97", "#38D6F5", "#FF8364"];
const ERASER = 15;
const WIDTHS = [8, 16, 28];
const ERASER_WIDTH = 48;
const FLUSH_MS = 170;

const colorOf = (c: number) => (c === ERASER ? BOARD : (PALETTE[c] ?? PALETTE[0]));

function applyOp(strokes: Stroke[], op: Op): Stroke[] {
  if (op.k === "c") return [];
  if (op.k === "u") return strokes.slice(0, -1);
  const existing = strokes.find((s) => s.id === op.id);
  if (existing) {
    existing.p.push(...op.p);
    return strokes;
  }
  return [...strokes, { id: op.id, c: op.c, w: op.w, p: [...op.p] }];
}

export function DrawPad({
  sid,
  turn,
  canDraw,
  replay = false,
  hint = "ارسم هنا بصباعك",
}: {
  sid: string;
  turn: number;
  canDraw: boolean;
  /** empty-board hint for the artist */
  hint?: string;
  /** just show the finished drawing (no live updates) */
  replay?: boolean;
}) {
  const { creds } = useRoom();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const sizeRef = useRef(320);

  // artist state
  const currentRef = useRef<Stroke | null>(null);
  const unsentRef = useRef<number[]>([]);
  const lastSentRef = useRef<[number, number] | null>(null);
  const queueRef = useRef<Op[]>([]);
  const sendingRef = useRef(false);
  const nextIdRef = useRef(1);

  const [color, setColor] = useState(0);
  const [width, setWidth] = useState(1);
  const [strokeCount, setStrokeCount] = useState(0);
  const colorRef = useRef(color);
  const widthRef = useRef(width);
  useEffect(() => {
    colorRef.current = color;
    widthRef.current = width;
  }, [color, width]);

  /* --- painting --------------------------------------------------------- */
  const paintStroke = useCallback((ctx: CanvasRenderingContext2D, s: Stroke, from = 0) => {
    const k = sizeRef.current / 1000;
    const pts = s.p;
    if (pts.length < 2) return;
    ctx.strokeStyle = colorOf(s.c);
    ctx.fillStyle = colorOf(s.c);
    ctx.lineWidth = Math.max(1.5, s.w * k);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const start = Math.max(0, from - 2);
    if (pts.length === 2) {
      ctx.beginPath();
      ctx.arc(pts[0] * k, pts[1] * k, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[start] * k, pts[start + 1] * k);
    for (let i = start + 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * k, pts[i + 1] * k);
    ctx.stroke();
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BOARD;
    ctx.fillRect(0, 0, sizeRef.current, sizeRef.current);
    for (const s of strokesRef.current) paintStroke(ctx, s);
    setStrokeCount(strokesRef.current.length);
  }, [paintStroke]);

  /* --- size: always a square that fits the column ------------------------ */
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const fit = () => {
      const size = Math.max(200, Math.floor(wrap.clientWidth));
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = size;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.height = `${size}px`;
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  /* --- guesser: follow the drawing ---------------------------------------- */
  useEffect(() => {
    if (!creds) return;
    let alive = true;
    const controller = new AbortController();
    strokesRef.current = [];
    redraw();

    const pull = async (after: number, wait: boolean) =>
      api<DrawResponse>(`/api/draw?sid=${sid}&turn=${turn}&after=${after}${wait ? "" : "&wait=0"}`, {
        creds,
        signal: controller.signal,
      });

    const run = async () => {
      let after = 0;
      // Both roles first load what is already on the board (e.g. after a reload).
      for (;;) {
        if (!alive) return;
        try {
          const res = await pull(after, !canDraw && !replay);
          if (!alive) return;
          for (const batch of res.batches) {
            for (const op of batch.ops as Op[]) strokesRef.current = applyOp(strokesRef.current, op);
            after = batch.seq;
          }
          if (res.batches.length) redraw();
          if (canDraw || replay) {
            nextIdRef.current = strokesRef.current.reduce((m, s) => Math.max(m, s.id), 0) + 1;
            return; // only the initial state was needed
          }
        } catch (err) {
          if (!alive || (err as Error)?.name === "AbortError") return;
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    };
    void run();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [creds, sid, turn, canDraw, replay, redraw]);

  /* --- artist: send batches ----------------------------------------------- */
  /** Move the not-yet-sent points of the stroke in progress into the send queue. */
  const seal = useCallback(() => {
    const cur = currentRef.current;
    const unsent = unsentRef.current;
    if (!cur || unsent.length === 0) return;
    const pts = lastSentRef.current ? [...lastSentRef.current, ...unsent] : [...unsent];
    lastSentRef.current = [unsent[unsent.length - 2], unsent[unsent.length - 1]];
    unsentRef.current = [];
    queueRef.current.push({ k: "s", id: cur.id, c: cur.c, w: cur.w, p: pts });
  }, []);

  const flush = useCallback(async () => {
    if (!creds) return;
    seal();
    if (sendingRef.current || queueRef.current.length === 0) return;
    sendingRef.current = true;
    const ops = queueRef.current.splice(0, 60);
    try {
      await api("/api/draw", { method: "POST", creds, body: { sid, turn, ops } });
    } catch (err) {
      // "not your turn any more" → drop; anything else → try again next tick
      if (!(err instanceof ApiError && err.status === 409)) queueRef.current.unshift(...ops);
    } finally {
      sendingRef.current = false;
    }
  }, [creds, sid, turn, seal]);

  useEffect(() => {
    if (!canDraw) return;
    const timer = setInterval(() => void flush(), FLUSH_MS);
    return () => {
      clearInterval(timer);
      void flush();
    };
  }, [canDraw, flush]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;
    return [Math.round(Math.max(0, Math.min(1000, x))), Math.round(Math.max(0, Math.min(1000, y)))];
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    seal(); // finish whatever was still pending from the previous stroke
    const [x, y] = point(e);
    const erasing = colorRef.current === ERASER;
    const stroke: Stroke = {
      id: nextIdRef.current++,
      c: colorRef.current,
      w: erasing ? ERASER_WIDTH : WIDTHS[widthRef.current],
      p: [x, y],
    };
    currentRef.current = stroke;
    lastSentRef.current = null;
    unsentRef.current = [x, y];
    strokesRef.current = [...strokesRef.current, stroke];
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) paintStroke(ctx, stroke);
    setStrokeCount(strokesRef.current.length);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cur = currentRef.current;
    if (!canDraw || !cur) return;
    e.preventDefault();
    const [x, y] = point(e);
    const n = cur.p.length;
    if (Math.abs(x - cur.p[n - 2]) + Math.abs(y - cur.p[n - 1]) < 4) return;
    cur.p.push(x, y);
    unsentRef.current.push(x, y);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) paintStroke(ctx, cur, cur.p.length - 2);
  };

  const onUp = () => {
    if (!currentRef.current) return;
    seal();
    currentRef.current = null;
    lastSentRef.current = null;
    void flush();
  };

  const undo = () => {
    if (!strokesRef.current.length) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    queueRef.current.push({ k: "u" });
    redraw();
  };

  const clear = () => {
    if (!strokesRef.current.length) return;
    strokesRef.current = [];
    queueRef.current.push({ k: "c" });
    redraw();
  };

  return (
    <div>
      <div
        ref={wrapRef}
        className={cn(
          "relative overflow-hidden rounded-3xl border bg-[#100d24]",
          canDraw ? "border-violet/60 shadow-glow" : "border-line-2",
        )}
      >
        <canvas
          ref={canvasRef}
          className={cn("block w-full touch-none select-none", canDraw && "cursor-crosshair")}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label={canDraw ? "لوحة الرسم" : "رسمة اللاعب التاني"}
          role="img"
        />
        {strokeCount === 0 && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-[14px] text-dim">
            {canDraw ? hint : replay ? "مفيش رسمة" : "الرسمة هتظهر هنا…"}
          </p>
        )}
      </div>

      {canDraw && (
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between gap-1.5" role="radiogroup" aria-label="لون القلم">
            {PALETTE.map((hex, i) => (
              <button
                key={hex}
                type="button"
                role="radio"
                aria-checked={color === i}
                aria-label={`لون ${i + 1}`}
                onClick={() => setColor(i)}
                className={cn("size-9 rounded-full transition-transform", color === i && "scale-110")}
                style={{
                  background: hex,
                  boxShadow: color === i ? `0 0 0 2px #090b18, 0 0 0 4px ${hex}` : "inset 0 0 0 1px rgb(255 255 255 / 0.25)",
                }}
              />
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={color === ERASER}
              aria-label="ممحاة"
              onClick={() => setColor(ERASER)}
              className={cn(
                "grid size-9 place-items-center rounded-full border transition-colors",
                color === ERASER ? "border-lavender bg-violet/30 text-cloud" : "border-line-2 text-mist",
              )}
            >
              <Eraser className="size-[18px]" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5" role="radiogroup" aria-label="سُمك القلم">
              {WIDTHS.map((w, i) => (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={width === i}
                  aria-label={["رفيع", "متوسط", "تخين"][i]}
                  onClick={() => setWidth(i)}
                  className={cn(
                    "grid size-10 place-items-center rounded-xl border transition-colors",
                    width === i ? "border-violet bg-violet/20" : "border-line-2",
                  )}
                >
                  <span className="rounded-full bg-cloud" style={{ width: 5 + i * 5, height: 5 + i * 5 }} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={strokeCount === 0}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line-2 px-3 text-[13px] text-mist transition-colors hover:text-cloud disabled:opacity-40"
              >
                <Undo2 className="size-4" />
                تراجع
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={strokeCount === 0}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line-2 px-3 text-[13px] text-mist transition-colors hover:text-rose disabled:opacity-40"
              >
                <Trash2 className="size-4" />
                مسح
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
