"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui";
import { gx } from "@/game/profile";
import type { GuessView } from "@/game/views";
import { cn } from "@/lib/cn";
import { type GameProps, MyAnswer, OptionButton, QuestionCard, useMove, Waiting } from "./shared";

/** «خمن إجابتي» — pick your own answer, then predict your partner's. */
export function GuessGame({ s, me, partner }: GameProps) {
  const cur = s.cur as GuessView;
  const { send, busy } = useMove();
  const [mine, setMine] = useState<number | null>(null);
  const [guess, setGuess] = useState<number | null>(null);
  const [step, setStep] = useState<"mine" | "guess">("mine");

  if (cur.mine) {
    return (
      <div className="space-y-4">
        <QuestionCard>{cur.text}</QuestionCard>
        <div className="grid grid-cols-2 gap-3">
          <MyAnswer label="إجابتك">{cur.options[cur.mine.mine]}</MyAnswer>
          <MyAnswer label={`توقعك لـ${partner.name}`}>{cur.options[cur.mine.guess]}</MyAnswer>
        </div>
        <Waiting partner={partner} />
      </div>
    );
  }

  const ready = mine !== null && guess !== null;
  return (
    <div className="space-y-4">
      <QuestionCard>{cur.text}</QuestionCard>

      {/* two small steps: me, then my prediction */}
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="خطوات الإجابة">
        <StepTab active={step === "mine"} done={mine !== null} onClick={() => setStep("mine")}>
          <Avatar avatar={me.avatar} color={me.color} size={24} />
          إجابتك إنت
        </StepTab>
        <StepTab active={step === "guess"} done={guess !== null} onClick={() => setStep("guess")} disabled={mine === null}>
          <Avatar avatar={partner.avatar} color={partner.color} size={24} />
          توقعك لـ{partner.name}
        </StepTab>
      </div>

      <div key={step} className="space-y-2.5 animate-rise">
        {cur.options.map((opt, i) =>
          step === "mine" ? (
            <OptionButton
              key={i}
              selected={mine === i}
              onClick={() => {
                setMine(i);
                setTimeout(() => setStep("guess"), 220);
              }}
            >
              {opt}
            </OptionButton>
          ) : (
            <OptionButton key={i} tone="partner" selected={guess === i} onClick={() => setGuess(i)}>
              {opt}
            </OptionButton>
          ),
        )}
      </div>

      <Button block disabled={!ready} loading={busy} onClick={() => ready && send({ t: "answer", mine, guess })}>
        {ready
          ? "إرسال الإجابة"
          : step === "mine"
            ? `${gx(me, "اختار", "اختاري")} إجابتك`
            : `${gx(me, "توقّع", "توقّعي")} إجابة ${partner.name}`}
      </Button>
    </div>
  );
}

function StepTab({
  active,
  done,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  done: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-2xl border px-2 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-40",
        active ? "border-violet bg-violet/15 text-cloud" : "border-line text-mist",
        done && !active && "border-mint/40 text-mint",
      )}
    >
      <span className="flex min-w-0 items-center gap-2 truncate">{children}</span>
    </button>
  );
}
