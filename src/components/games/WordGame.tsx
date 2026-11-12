"use client";

import { useState } from "react";
import { gx } from "@/game/profile";
import type { WordView } from "@/game/views";
import { AnswerInput, type GameProps, MyAnswer, QuestionCard, useMove, Waiting } from "./shared";

/** «أول كلمة» — write the first word that comes to mind; matching scores for both. */
export function WordGame({ s, me, partner }: GameProps) {
  const cur = s.cur as WordView;
  const { send, busy } = useMove();
  const [text, setText] = useState("");

  return (
    <div className="space-y-4">
      <QuestionCard label="أول كلمة تيجي في بالك عن…" className="py-8">
        <span className="text-[30px] text-gradient">{cur.text}</span>
      </QuestionCard>

      {cur.mine !== null ? (
        <>
          <MyAnswer label="كلمتك">{cur.mine || "—"}</MyAnswer>
          <Waiting partner={partner} />
        </>
      ) : (
        <>
          <AnswerInput
            value={text}
            onChange={setText}
            onSubmit={() => text.trim() && send({ t: "answer", text })}
            placeholder="كلمة واحدة…"
            maxLength={30}
            busy={busy}
          />
          <p className="text-center text-[12px] text-dim">{gx(me, "متفكرش", "متفكريش")} كتير — الهدف تكتبوا نفس الكلمة.</p>
        </>
      )}
    </div>
  );
}
