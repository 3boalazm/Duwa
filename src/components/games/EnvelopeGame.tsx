"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button, Dots } from "@/components/ui";
import { gx } from "@/game/profile";
import type { EnvelopeView } from "@/game/views";
import { cn } from "@/lib/cn";
import type { PlayerView } from "@/server/contracts";
import { type GameProps, MyAnswer, QuestionCard, useMove, Waiting } from "./shared";

/** «الظرف المجهول» — open it together, answer in secret, reveal together. */
export function EnvelopeGame({ s, me, partner }: GameProps) {
  const cur = s.cur as EnvelopeView;
  const { send, busy } = useMove();
  const [text, setText] = useState("");

  if (cur.step === "sealed") {
    const iOpened = cur.opened[me.seat];
    const theyOpened = cur.opened[partner.seat];
    return (
      <div className="flex flex-col items-center pt-4 text-center">
        <button
          type="button"
          disabled={iOpened || busy}
          onClick={() => send({ t: "open" })}
          aria-label="افتح الظرف"
          className={cn("group relative transition-transform duration-300", !iOpened && "animate-float active:scale-95")}
        >
          <EnvelopeArt open={iOpened} />
        </button>
        <h2 className="mt-7 text-[22px] font-bold">{iOpened ? "فتحت الظرف…" : "ظرف مقفول"}</h2>
        <p className="mt-1.5 text-[15px] text-mist">
          {iOpened ? (
            <>
              مستنيين {partner.name} {gx(partner, "يفتحه", "تفتحه")} كمان <Dots className="ms-1 align-middle text-lavender" />
            </>
          ) : theyOpened ? (
            `${partner.name} ${gx(partner, "فتح الظرف ومستنيك", "فتحت الظرف ومستنياك")}!`
          ) : (
            "السؤال بيظهر لما تفتحوه إنتوا الاتنين."
          )}
        </p>
        {!iOpened && (
          <Button className="mt-7" block loading={busy} onClick={() => send({ t: "open" })}>
            {gx(me, "افتح", "افتحي")} الظرف
          </Button>
        )}
      </div>
    );
  }

  const mine = cur.mine;
  if (mine) {
    return (
      <div className="space-y-4">
        <QuestionCard label={cur.kind === "who" ? "مين فينا؟" : "سؤال من الظرف"}>{cur.text}</QuestionCard>
        <MyAnswer>
          {"who" in mine ? (mine.who === me.seat ? "أنا" : partner.name) : "text" in mine ? mine.text : "— سبته فاضي —"}
        </MyAnswer>
        <Waiting partner={partner} />
      </div>
    );
  }

  if (cur.kind === "who") {
    return (
      <div className="space-y-5">
        <QuestionCard label="مين فينا؟">{cur.text}</QuestionCard>
        <div className="grid grid-cols-2 gap-3">
          <WhoButton player={me} label="أنا" disabled={busy} onClick={() => send({ t: "answer", who: me.seat })} />
          <WhoButton player={partner} label={partner.name} disabled={busy} onClick={() => send({ t: "answer", who: partner.seat })} />
        </div>
        <p className="text-center text-[12px] text-dim">لو اختارتوا نفس الشخص، تكسبوا نقطة توافق.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <QuestionCard label="سؤال من الظرف">{cur.text}</QuestionCard>
      <label className="block">
        <span className="sr-only">إجابتك</span>
        <textarea
          value={text}
          maxLength={240}
          rows={4}
          placeholder={`${gx(me, "اكتب", "اكتبي")} براحتك… محدش هيشوف إجابتك غير لما تتكشف الإجابتين سوا.`}
          onChange={(e) => setText(e.target.value)}
          className="w-full resize-none rounded-2xl border border-line-2 bg-midnight/70 p-4 text-[16px] leading-7 text-cloud placeholder:text-dim outline-none transition-[border-color,box-shadow] focus:border-violet focus:shadow-[0_0_0_4px_rgb(129_85_239/0.22)]"
        />
      </label>
      <div className="flex items-center justify-between text-[12px] text-dim">
        <span>مفيش إجابة صح أو غلط.</span>
        <span className="num">{text.length} / 240</span>
      </div>
      <Button block disabled={!text.trim()} loading={busy} onClick={() => send({ t: "answer", text })}>
        <Check className="size-5" />
        إجابتي جاهزة
      </Button>
    </div>
  );
}

function WhoButton({ player, label, disabled, onClick }: { player: PlayerView; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="card flex flex-col items-center gap-2.5 px-3 py-5 transition-all duration-200 hover:border-lavender/50 active:scale-95 disabled:opacity-60"
    >
      <Avatar avatar={player.avatar} color={player.color} size={72} glow />
      <span className="max-w-full truncate text-[17px] font-bold">{label}</span>
    </button>
  );
}

/** A little envelope drawn in SVG; the flap lifts when opened. */
export function EnvelopeArt({ open, size = 168 }: { open?: boolean; size?: number }) {
  return (
    <svg width={size} height={size * 0.82} viewBox="0 0 200 164" fill="none" aria-hidden className="drop-shadow-[0_18px_40px_rgb(129_85_239/0.6)]">
      <defs>
        <linearGradient id="env-body" x1="0" y1="40" x2="200" y2="164" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8E63FF" />
          <stop offset="1" stopColor="#5B6CFF" />
        </linearGradient>
        <linearGradient id="env-flap" x1="100" y1="40" x2="100" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B19AFF" />
          <stop offset="1" stopColor="#8155EF" />
        </linearGradient>
      </defs>
      {open && (
        <g className="animate-rise">
          <rect x="34" y="14" width="132" height="96" rx="10" fill="#F2F0FA" />
          <rect x="52" y="36" width="96" height="8" rx="4" fill="#B19AFF" />
          <rect x="52" y="54" width="70" height="8" rx="4" fill="#D9CCFF" />
          <text x="100" y="94" textAnchor="middle" fontSize="30" fontWeight="800" fill="#8155EF" fontFamily="var(--font-latin)">
            ?
          </text>
        </g>
      )}
      <rect x="12" y="48" width="176" height="110" rx="16" fill="url(#env-body)" />
      <path d="M12 150 L78 98 M188 150 L122 98" stroke="#fff" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round" />
      {open ? (
        <path d="M18 52 L100 4 L182 52 Z" fill="url(#env-flap)" opacity=".55" />
      ) : (
        <>
          <path d="M16 56 Q14 48 24 48 H176 Q186 48 184 56 L108 114 Q100 120 92 114 Z" fill="url(#env-flap)" />
          <circle cx="100" cy="106" r="15" fill="#F2F0FA" />
          <path d="M100 98.5 c-3.2 -4.4 -10 -1.6 -8.6 4 c1 4 5.4 6.6 8.6 9 c3.2 -2.4 7.6 -5 8.6 -9 c1.4 -5.6 -5.4 -8.4 -8.6 -4 Z" fill="#8155EF" />
        </>
      )}
    </svg>
  );
}
