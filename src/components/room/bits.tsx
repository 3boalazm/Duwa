"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { PlayerView, RoomView } from "@/server/contracts";
import type { Seat } from "@/game/types";

/** Look up a player by seat from the current player's point of view. */
export function playerAt(view: RoomView, seat: Seat): PlayerView | null {
  return view.me.seat === seat ? view.me : view.partner;
}

export function nameAt(view: RoomView, seat: Seat): string {
  return playerAt(view, seat)?.name ?? "لاعب";
}

/** One line describing how a finished round ended. */
export function outcomeLine(view: RoomView, r: { coop: boolean; winner: Seat | null; score: [number, number]; headline: string }): string {
  if (r.coop) return r.headline;
  if (r.winner === null) return `تعادل ${r.score[0]} – ${r.score[1]}`;
  const w = r.winner;
  const l = w === 0 ? 1 : 0;
  return `فوز ${nameAt(view, w)} ${r.score[w]} – ${r.score[l]}`;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3 animate-rise">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[14px] text-mist">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Points({ value, className, size = "md" }: { value: number; className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "text-[13px]", md: "text-[17px]", lg: "text-[44px]" } as const;
  return <span className={cn("num font-bold", sizes[size], className)}>{value.toLocaleString("en-US")}</span>;
}
