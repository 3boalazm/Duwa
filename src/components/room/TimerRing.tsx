"use client";

import { useCountdown } from "@/client/room";
import { cn } from "@/lib/cn";

/**
 * Countdown ring driven by the server deadline, so both phones show the
 * same remaining time. Turns warm in the last five seconds.
 */
export function TimerRing({
  endsAt,
  totalMs,
  size = 56,
  frozen = false,
}: {
  endsAt: number | null;
  totalMs: number | null;
  size?: number;
  frozen?: boolean;
}) {
  const left = useCountdown(endsAt);
  const total = totalMs && totalMs > 0 ? totalMs : 1;
  const ratio = frozen || !endsAt ? 1 : Math.max(0, Math.min(1, left / total));
  const secs = Math.ceil(left / 1000);
  const urgent = !frozen && !!endsAt && left <= 5000;
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={cn("relative grid shrink-0 place-items-center rounded-full", urgent && "animate-breathe")}
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 16px -4px ${urgent ? "rgb(255 107 147 / 0.9)" : "rgb(129 85 239 / 0.9)"}`,
      }}
      role="timer"
      aria-label={frozen ? "الوقت متوقف" : `باقي ${secs} ثانية`}
    >
      <svg viewBox="0 0 56 56" width={size} height={size} className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={urgent ? "#ff6b93" : "#9b78ff"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          style={{ transition: "stroke-dashoffset 120ms linear, stroke 300ms" }}
        />
      </svg>
      <span className={cn("num absolute text-[15px] font-bold", urgent ? "text-rose" : "text-cloud")}>
        {frozen || !endsAt ? "–" : secs}
      </span>
    </div>
  );
}
