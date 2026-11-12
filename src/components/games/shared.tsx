"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Check, Send } from "lucide-react";
import { ApiError, errorMessage } from "@/client/api";
import { useRoom } from "@/client/room";
import { Avatar } from "@/components/Avatar";
import { Dots } from "@/components/ui";
import type { SessionView } from "@/game/engine";
import { gx } from "@/game/profile";

import { cn } from "@/lib/cn";
import type { PlayerView, RoomView } from "@/server/contracts";

export interface GameProps {
  view: RoomView;
  s: SessionView;
  me: PlayerView;
  partner: PlayerView;
}

/** Send a game move; rule refusals are returned so the game can show them inline. */
export function useMove() {
  const { act, toast } = useRoom();
  const [busy, setBusy] = useState(false);

  const send = useCallback(
    async (move: Record<string, unknown>, opts: { quiet?: boolean } = {}): Promise<string | null> => {
      setBusy(true);
      try {
        await act({ type: "play", move });
        return null;
      } catch (err) {
        const message = errorMessage(err);
        // "already answered" / "too late" just mean the round moved on: no need to shout.
        const benign = err instanceof ApiError && (err.code === "already" || err.code === "too_late");
        if (!opts.quiet && !benign) toast(message, "bad");
        return message;
      } finally {
        setBusy(false);
      }
    },
    [act, toast],
  );

  return { send, busy };
}

export function QuestionCard({ label, children, className }: { label?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("card-glow px-5 py-6 text-center animate-pop", className)}>
      {label && <p className="mb-2 text-[12px] font-medium text-lavender">{label}</p>}
      <p className="text-balance text-[21px] font-bold leading-9 font-display">{children}</p>
    </div>
  );
}

export function OptionButton({
  selected,
  disabled,
  onClick,
  children,
  tone = "violet",
}: {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  tone?: "violet" | "partner";
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start text-[16px] font-medium transition-all duration-200 active:scale-[0.985] disabled:active:scale-100",
        selected
          ? tone === "partner"
            ? "border-indigo bg-indigo/20 text-cloud shadow-[0_0_0_1px_rgb(91_108_255/0.6),0_10px_30px_-14px_rgb(91_108_255/0.9)]"
            : "border-violet bg-violet/20 text-cloud shadow-glow"
          : "border-line-2 bg-navy-2/70 text-cloud/90 hover:border-lavender/50",
        disabled && !selected && "opacity-50",
      )}
    >
      <span>{children}</span>
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
          selected ? (tone === "partner" ? "border-indigo bg-indigo text-white" : "border-violet bg-violet text-white") : "border-line-2",
        )}
      >
        {selected && <Check className="size-4" strokeWidth={3} />}
      </span>
    </button>
  );
}

/** Single-line answer box with a send button (Enter also sends). */
export function AnswerInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  maxLength,
  busy,
  disabled,
  autoFocus = true,
  sendLabel = "إرسال",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  maxLength: number;
  busy?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  sendLabel?: string;
}) {
  return (
    <form
      className="flex items-stretch gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && !busy) onSubmit();
      }}
    >
      <input
        // the round is timed: the keyboard should be ready
        autoFocus={autoFocus}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="send"
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-14 min-w-0 flex-1 rounded-2xl border border-line-2 bg-midnight/70 px-4 text-[17px] text-cloud placeholder:text-dim outline-none transition-[border-color,box-shadow] focus:border-violet focus:shadow-[0_0_0_4px_rgb(129_85_239/0.22)] disabled:opacity-50"
      />
      <button
        type="submit"
        aria-label={sendLabel}
        disabled={disabled || busy}
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#9670ff,#5b6cff)] text-white shadow-[0_12px_30px_-12px_rgb(129_85_239/0.95)] transition-transform active:scale-95 disabled:opacity-45"
      >
        {busy ? <Dots /> : <Send className="size-5 -scale-x-100" />}
      </button>
    </form>
  );
}

/** Shown after you answered and the other player has not yet. */
export function Waiting({ partner, children }: { partner: PlayerView; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center animate-rise" role="status">
      <div className="relative">
        <Avatar avatar={partner.avatar} color={partner.color} size={56} />
        <span className="absolute inset-0 rounded-full border-2 border-violet/60 animate-breathe" aria-hidden />
      </div>
      <p className="text-[15px] text-mist">
        {children ?? (
          <>
            إجابتك اتسجلت. مستنيين <b className="font-semibold text-cloud">{partner.name}</b>
          </>
        )}{" "}
        <Dots className="ms-1 align-middle text-lavender" />
      </p>
    </div>
  );
}

/** Small "thinking… / answered" pill for the other player. */
export function PartnerPill({ partner, done, className }: { partner: PlayerView; done: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium",
        done ? "border-mint/40 bg-mint/10 text-mint" : "border-line-2 bg-white/5 text-mist",
        className,
      )}
      role="status"
    >
      {done ? <Check className="size-3.5" strokeWidth={3} /> : <Dots className="scale-75" />}
      {partner.name} {done ? gx(partner, "جاوب", "جاوبت") : gx(partner, "بيفكر", "بتفكر")}
    </span>
  );
}

export function MyAnswer({ label = "إجابتك", children }: { label?: string; children: ReactNode }) {
  return (
    <div className="card px-4 py-3 text-center animate-rise">
      <p className="text-[12px] text-mist">{label}</p>
      <p className="mt-0.5 break-words text-[17px] font-semibold">{children}</p>
    </div>
  );
}
