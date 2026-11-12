"use client";

import { useState } from "react";
import { Ban, Heart } from "lucide-react";
import { gx } from "@/game/profile";
import type { NoYesView } from "@/game/views";
import { cn } from "@/lib/cn";
import { AnswerInput, type GameProps, MyAnswer, QuestionCard, useMove, Waiting } from "./shared";

export function Hearts({ lives, total = 3, className }: { lives: number; total?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${lives} قلوب من ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <Heart key={i} className={cn("size-4 transition-all", i < lives ? "fill-rose text-rose" : "text-dim/60")} />
      ))}
    </span>
  );
}

/** «ممنوع آه ولا لأ» — answer fast without the two forbidden words. */
export function NoYesGame({ s, me, partner }: GameProps) {
  const cur = s.cur as NoYesView;
  const { send, busy } = useMove();
  const [text, setText] = useState("");

  return (
    <div className="space-y-4">
      <QuestionCard
        label={
          <span className="inline-flex items-center gap-1.5 text-rose">
            <Ban className="size-3.5" />
            ممنوع: «آه» و«لأ» — وممنوع تكرر إجابة
          </span>
        }
      >
        {cur.text}
      </QuestionCard>

      {cur.mine !== null ? (
        <>
          <MyAnswer>{cur.mine || "— من غير رد —"}</MyAnswer>
          <Waiting partner={partner} />
        </>
      ) : (
        <>
          <AnswerInput
            value={text}
            onChange={setText}
            onSubmit={() => text.trim() && send({ t: "answer", text })}
            placeholder={`${gx(me, "اكتب", "اكتبي")} ردّك بسرعة…`}
            maxLength={60}
            busy={busy}
          />
          <p className="text-center text-[12px] text-dim">لو الوقت خلص من غير رد، {gx(me, "بتخسر", "بتخسري")} قلب.</p>
        </>
      )}
    </div>
  );
}
