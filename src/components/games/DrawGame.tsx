"use client";

import { useState } from "react";
import { Lightbulb, Pencil } from "lucide-react";
import { Chip, Dots } from "@/components/ui";
import { gx } from "@/game/profile";
import type { DrawView } from "@/game/views";
import { cn } from "@/lib/cn";
import { DrawPad } from "./DrawPad";
import { AnswerInput, type GameProps, QuestionCard, useMove, Waiting } from "./shared";

/** «خمن الرسمة» — one draws the secret word, the other guesses; roles alternate. */
export function DrawGame({ s, me, partner }: GameProps) {
  const cur = s.cur as DrawView;
  const { send, busy } = useMove();
  const [text, setText] = useState("");
  const iDraw = cur.drawer === me.seat;

  if (cur.step === "choose") {
    if (!iDraw) {
      return (
        <div className="space-y-4">
          <QuestionCard label={`دورك ${gx(me, "تخمّن", "تخمّني")}`}>
            {gx(me, "جهّز", "جهّزي")} نفسك… {partner.name} {gx(partner, "بيختار", "بتختار")} كلمة
          </QuestionCard>
          <Waiting partner={partner}>
            {partner.name} {gx(partner, "بيختار هيرسم إيه", "بتختار هترسم إيه")}
          </Waiting>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <QuestionCard label={`دورك ${gx(me, "ترسم", "ترسمي")}`}>{gx(me, "اختار كلمة ترسمها", "اختاري كلمة ترسميها")}</QuestionCard>
        <div className="space-y-2.5">
          {(cur.choices ?? []).map((w, i) => (
            <button
              key={w}
              type="button"
              disabled={busy}
              onClick={() => send({ t: "choose", i })}
              className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border border-line-2 bg-navy-2/70 px-4 text-[19px] font-bold transition-all hover:border-lavender/60 active:scale-[0.98] disabled:opacity-60"
            >
              <Pencil className="size-4 text-lavender" />
              {w}
            </button>
          ))}
        </div>
        <p className="text-center text-[12px] text-dim">لو الوقت خلص، هنختار لك أول كلمة.</p>
      </div>
    );
  }

  const wrong = cur.guesses;

  if (iDraw) {
    return (
      <div className="space-y-3">
        <div className="card flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-[13px] text-mist">{gx(me, "ارسم", "ارسمي")}:</span>
          <span className="flex-1 truncate text-center text-[21px] font-bold font-display text-gradient">{cur.word}</span>
          <Chip tone="muted">
            {partner.name} {gx(partner, "بيخمّن", "بتخمّن")} <Dots className="scale-75" />
          </Chip>
        </div>
        <DrawPad key={`${s.id}:${s.round}`} sid={s.id} turn={s.round} canDraw hint={gx(me, "ارسم هنا بصباعك", "ارسمي هنا بصباعك")} />
        <GuessFeed guesses={wrong} label={`تخمينات ${partner.name}`} />
        <p className="text-center text-[12px] text-dim">ممنوع {gx(me, "تكتب", "تكتبي")} الكلمة جوه الرسمة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-3">
        <WordShape shape={cur.shape} hint={cur.hint} />
        {cur.hint && (
          <Chip tone="amber">
            <Lightbulb className="size-3.5" />
            أول حرف: {cur.hint}
          </Chip>
        )}
      </div>
      <DrawPad key={`${s.id}:${s.round}`} sid={s.id} turn={s.round} canDraw={false} />
      <AnswerInput
        value={text}
        onChange={setText}
        onSubmit={() => {
          const guess = text.trim();
          if (!guess) return;
          setText("");
          void send({ t: "guess", text: guess });
        }}
        placeholder={`${partner.name} ${gx(partner, "بيرسم", "بترسم")} إيه؟`}
        maxLength={24}
        busy={busy}
        autoFocus={false}
        sendLabel="خمّن"
      />
      <GuessFeed guesses={wrong} label="تخميناتك" />
    </div>
  );
}

/** Blanks for each letter of the secret word. */
function WordShape({ shape, hint }: { shape: number[]; hint: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1" aria-label={`الكلمة ${shape.reduce((a, b) => a + b, 0)} حروف`}>
      {shape.map((n, wi) => (
        <span key={wi} className="flex gap-1.5">
          {Array.from({ length: n }, (_, i) => (
            <span
              key={i}
              className="grid h-8 w-6 place-items-end justify-center border-b-2 border-lavender/70 pb-0.5 text-[18px] font-bold leading-none"
            >
              {wi === 0 && i === 0 && hint ? hint : ""}
            </span>
          ))}
        </span>
      ))}
      <span className="num text-[12px] text-dim">{shape.reduce((a, b) => a + b, 0)} حروف</span>
    </div>
  );
}

function GuessFeed({ guesses, label }: { guesses: DrawView["guesses"]; label: string }) {
  if (!guesses.length) return null;
  return (
    <div aria-live="polite">
      <p className="mb-1.5 text-[12px] text-dim">{label}</p>
      <ul className="flex flex-wrap gap-1.5">
        {guesses.slice(-8).map((g, i) => (
          <li
            key={`${g.at}-${i}`}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px] animate-pop",
              g.close ? "border-amber/50 bg-amber/10 text-amber" : "border-line-2 bg-white/5 text-mist",
            )}
          >
            {g.text}
            {g.close && " · قريبة!"}
          </li>
        ))}
      </ul>
    </div>
  );
}
