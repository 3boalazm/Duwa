"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleHelp, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button, Chip } from "@/components/ui";
import { gx } from "@/game/profile";
import type { MinuteView } from "@/game/views";
import { cn } from "@/lib/cn";
import { AnswerInput, type GameProps, QuestionCard, useMove, Waiting } from "./shared";

/** «تحدي الدقيقة» — list as many valid answers as you can before the time runs out. */
export function MinuteGame({ s, me, partner }: GameProps) {
  const cur = s.cur as MinuteView;
  const { send, busy } = useMove();
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  // null = untouched: dictionary challenges start from "rejected", open ones from "accepted"
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [cur.mine.length]);

  const add = async () => {
    const word = text.trim();
    if (!word) return;
    setText("");
    const problem = await send({ t: "entry", text: word }, { quiet: true });
    setNote(problem);
    if (problem) setTimeout(() => setNote((n) => (n === problem ? null : n)), 2200);
  };

  const confirmed = cur.mine.filter((e) => e.st === "ok").length;
  const pending = cur.mine.filter((e) => e.st === "ask").length;
  const count = cur.dict ? confirmed : confirmed + pending;
  const rejected = picked ?? new Set(cur.dict ? cur.toJudge.map((e) => e.i) : []);

  if (cur.step === "review") {
    const done = cur.reviewed[me.seat];
    if (done || cur.toJudge.length === 0) {
      return (
        <div className="space-y-4">
          <QuestionCard label="انتهى الوقت">{cur.title}</QuestionCard>
          <Waiting partner={partner}>
            {done ? `سجّلنا حكمك. مستنيين ${partner.name}` : `${partner.name} ${gx(partner, "بيراجع", "بتراجع")} إجاباتك`}
          </Waiting>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <QuestionCard label="إنت الحكم دلوقتي">{cur.title}</QuestionCard>
        <p className="text-center text-[14px] leading-6 text-mist">
          {cur.dict
            ? `دي إجابات ${partner.name} اللي مش في القاموس. ${gx(me, "اقبل", "اقبلي")} الصح منها بس.`
            : `دي إجابات ${partner.name}. ${gx(me, "ارفض", "ارفضي")} أي إجابة مش مناسبة للتحدي.`}{" "}
          {gx(me, "اضغط على الإجابة عشان تغيّر الحكم", "اضغطي على الإجابة عشان تغيّري الحكم")}.
        </p>
        <ul className="space-y-2">
          {cur.toJudge.map((e) => {
            const no = rejected.has(e.i);
            return (
              <li key={e.i}>
                <button
                  type="button"
                  aria-pressed={!no}
                  onClick={() => {
                    const next = new Set(rejected);
                    if (next.has(e.i)) next.delete(e.i);
                    else next.add(e.i);
                    setPicked(next);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-[16px] font-medium transition-colors",
                    no ? "border-rose/40 bg-rose/10 text-rose line-through" : "border-mint/40 bg-mint/10 text-cloud",
                  )}
                >
                  {e.text}
                  {no ? <ThumbsDown className="size-5 shrink-0" /> : <ThumbsUp className="size-5 shrink-0 text-mint" />}
                </button>
              </li>
            );
          })}
        </ul>
        <Button block loading={busy} onClick={() => send({ t: "review", reject: [...rejected] })}>
          <Check className="size-5" />
          تأكيد الحكم
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <QuestionCard label={`الهدف: ${cur.target} إجابات`}>{cur.title}</QuestionCard>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="card py-3">
          <p className="num text-[30px] font-bold leading-none text-gradient">{count}</p>
          <p className="mt-1 text-[12px] text-mist">
            إجاباتك{cur.dict && pending > 0 && <span className="text-amber"> · <span className="num">{pending}</span> مستنية الحكم</span>}
          </p>
        </div>
        <div className="card py-3">
          <p className="num text-[30px] font-bold leading-none text-cloud/80">{cur.partnerCount}</p>
          <p className="mt-1 text-[12px] text-mist">
            {partner.name}
            {cur.partnerPending > 0 && <span className="text-amber"> · <span className="num">{cur.partnerPending}</span> مستنية</span>}
          </p>
        </div>
      </div>

      <AnswerInput
        value={text}
        onChange={setText}
        onSubmit={add}
        placeholder={gx(me, "اكتب إجابة واضغط إرسال…", "اكتبي إجابة واضغطي إرسال…")}
        maxLength={24}
        sendLabel="إضافة"
      />
      <p className={cn("h-5 text-center text-[13px]", note ? "text-amber" : "text-dim")} aria-live="polite">
        {note ?? "كل إجابة لوحدها. الكلمات المكررة مش بتتحسب."}
      </p>

      <ul ref={listRef} className="flex max-h-[30dvh] flex-wrap content-start gap-2 overflow-y-auto pb-1">
        {cur.mine.map((e, i) => (
          <li key={i} className="animate-pop">
            <Chip tone={e.st === "ok" ? "mint" : "amber"} className="px-3 py-1 text-[14px]">
              {e.st === "ok" ? <Check className="size-3.5" strokeWidth={3} /> : <CircleHelp className="size-3.5" />}
              {e.text}
            </Chip>
          </li>
        ))}
      </ul>
      {cur.mine.some((e) => e.st === "ask") && (
        <p className="text-center text-[12px] text-dim">
          <CircleHelp className="me-1 inline size-3.5 text-amber" />
          الإجابات دي {gx(partner, "هيحكم", "هتحكم")} عليها {partner.name} بعد الوقت.
        </p>
      )}
    </div>
  );
}
