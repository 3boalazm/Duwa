"use client";

import type { ReactNode } from "react";
import { Check, CircleHelp, Sparkles, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Chip } from "@/components/ui";
import type {
  DrawLog,
  EnvelopeAnswer,
  EnvelopeLog,
  GuessLog,
  MinuteLog,
  NoYesLog,
  NoYesVerdict,
  RoundLog,
  WordLog,
} from "@/game/types";
import { gx } from "@/game/profile";
import { cn } from "@/lib/cn";
import type { PlayerView } from "@/server/contracts";
import { DrawPad } from "./DrawPad";
import { Hearts } from "./NoYesGame";
import { type GameProps, QuestionCard } from "./shared";

/** What both players see once a round is revealed (always from the round log). */
export function Reveal(props: GameProps) {
  const log: RoundLog | undefined = props.s.log[props.s.log.length - 1];
  if (!log) return null;
  switch (log.g) {
    case "guess":
      return <GuessReveal {...props} log={log} />;
    case "noyes":
      return <NoYesReveal {...props} log={log} />;
    case "word":
      return <WordReveal {...props} log={log} />;
    case "envelope":
      return <EnvelopeReveal {...props} log={log} />;
    case "minute":
      return <MinuteReveal {...props} log={log} />;
    case "draw":
      return <DrawReveal {...props} log={log} />;
  }
}

function Verdict({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <Chip tone={ok ? "mint" : "rose"} className="shrink-0">
      {ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
      {children}
    </Chip>
  );
}

function Banner({ tone, children }: { tone: "good" | "soft" | "bad"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "rounded-2xl border px-4 py-3 text-center text-[17px] font-bold animate-pop",
        tone === "good" && "border-mint/40 bg-mint/10 text-mint",
        tone === "soft" && "border-amber/40 bg-amber/10 text-amber",
        tone === "bad" && "border-line-2 bg-white/5 text-mist",
      )}
    >
      {children}
    </p>
  );
}

/* ----------------------------- خمن إجابتي ----------------------------- */
function GuessReveal({ me, partner, log }: GameProps & { log: GuessLog }) {
  const label = (i: number) => (i >= 0 ? log.options[i] : "— من غير إجابة —");
  const block = (owner: PlayerView, guesser: PlayerView) => (
    <div className="card p-4 animate-rise">
      <div className="flex items-center gap-3">
        <Avatar avatar={owner.avatar} color={owner.color} size={40} />
        <div className="min-w-0">
          <p className="text-[12px] text-mist">إجابة {owner.name}</p>
          <p className="truncate text-[17px] font-bold">{label(log.mine[owner.seat])}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
        <Avatar avatar={guesser.avatar} color={guesser.color} size={28} />
        <p className="min-w-0 flex-1 truncate text-[14px] text-mist">
          توقّع {guesser.name}: <span className="text-cloud">{label(log.guess[guesser.seat])}</span>
        </p>
        <Verdict ok={log.hit[guesser.seat]}>{log.hit[guesser.seat] ? "صح" : "غلط"}</Verdict>
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <QuestionCard className="py-4">{log.text}</QuestionCard>
      {block(me, partner)}
      {block(partner, me)}
    </div>
  );
}

/* --------------------------- ممنوع آه ولا لأ --------------------------- */
const VERDICT_TEXT: Record<NoYesVerdict, [string, string]> = {
  ok: ["عدّى", "عدّت"],
  forbidden: ["قال الممنوع", "قالت الممنوع"],
  empty: ["سكت", "سكتت"],
  repeat: ["كرّر إجابة", "كرّرت إجابة"],
};

function NoYesReveal({ me, partner, log }: GameProps & { log: NoYesLog }) {
  const row = (p: PlayerView) => {
    const v = log.verdict[p.seat];
    return (
      <div className="card flex items-center gap-3 p-4 animate-rise">
        <Avatar avatar={p.avatar} color={p.color} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] text-mist">{p.name}</p>
            <Hearts lives={log.lives[p.seat]} />
          </div>
          <p className={cn("break-words text-[17px] font-semibold", v !== "ok" && "text-rose")}>
            {log.ans[p.seat] ? `«${log.ans[p.seat]}»` : "…"}
          </p>
        </div>
        <Verdict ok={v === "ok"}>
          {v === "forbidden" && log.bad[p.seat] ? `${gx(p, "قال", "قالت")} «${log.bad[p.seat]}»` : gx(p, ...VERDICT_TEXT[v])}
        </Verdict>
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <QuestionCard className="py-4">{log.text}</QuestionCard>
      {row(me)}
      {row(partner)}
    </div>
  );
}

/* ------------------------------ أول كلمة ------------------------------ */
function WordReveal({ me, partner, log }: GameProps & { log: WordLog }) {
  const word = (p: PlayerView) => (
    <div className="card flex flex-col items-center gap-2 px-3 py-4 text-center animate-rise">
      <Avatar avatar={p.avatar} color={p.color} size={40} />
      <p className="max-w-full break-words text-[20px] font-bold font-display">{log.ans[p.seat] || "—"}</p>
      <p className="text-[12px] text-mist">{p.name}</p>
    </div>
  );
  return (
    <div className="space-y-3">
      <QuestionCard label="الموضوع" className="py-4">
        {log.text}
      </QuestionCard>
      <div className="grid grid-cols-2 gap-3">
        {word(me)}
        {word(partner)}
      </div>
      {log.match === "exact" ? (
        <Banner tone="good">
          <Sparkles className="me-1.5 inline size-5" />
          توافق تام! <span className="num">+2</span>
        </Banner>
      ) : log.match === "close" ? (
        <Banner tone="soft">
          قريبين من بعض! <span className="num">+1</span>
        </Banner>
      ) : (
        <Banner tone="bad">كل واحد في وادي المرة دي</Banner>
      )}
    </div>
  );
}

/* ---------------------------- الظرف المجهول ---------------------------- */
function EnvelopeReveal({ me, partner, log }: GameProps & { log: EnvelopeLog }) {
  const players = [me, partner];
  const byseat = (seat: number) => players.find((p) => p.seat === seat);

  if (log.kind === "who") {
    const pick = (p: PlayerView) => {
      const a: EnvelopeAnswer = log.ans[p.seat];
      const chosen = "who" in a ? byseat(a.who) : undefined;
      return (
        <div className="card flex flex-col items-center gap-2 px-3 py-4 text-center animate-rise">
          <p className="text-[12px] text-mist">{p.name} {gx(p, "اختار", "اختارت")}</p>
          {chosen ? (
            <>
              <Avatar avatar={chosen.avatar} color={chosen.color} size={56} glow />
              <p className="max-w-full truncate text-[16px] font-bold">{chosen.seat === p.seat ? gx(p, "نفسه", "نفسها") : chosen.name}</p>
            </>
          ) : (
            <>
              <span className="grid size-14 place-items-center rounded-full bg-white/6 text-dim">
                <CircleHelp className="size-6" />
              </span>
              <p className="text-[14px] text-mist">من غير اختيار</p>
            </>
          )}
        </div>
      );
    };
    return (
      <div className="space-y-3">
        <QuestionCard label="مين فينا؟" className="py-4">
          {log.text}
        </QuestionCard>
        <div className="grid grid-cols-2 gap-3">
          {pick(me)}
          {pick(partner)}
        </div>
        {log.agree ? <Banner tone="good">متفقين! نقطة توافق</Banner> : <Banner tone="bad">كل واحد شايفها بشكل… اتناقشوا فيها</Banner>}
      </div>
    );
  }

  const answer = (p: PlayerView) => {
    const a = log.ans[p.seat];
    return (
      <div className="card p-4 animate-rise">
        <div className="mb-2 flex items-center gap-2.5">
          <Avatar avatar={p.avatar} color={p.color} size={32} />
          <p className="text-[14px] font-semibold">{p.name}</p>
        </div>
        <p className={cn("whitespace-pre-wrap break-words text-[16px] leading-8", "text" in a ? "text-cloud" : "text-dim")}>
          {"text" in a ? a.text : "من غير إجابة"}
        </p>
      </div>
    );
  };
  return (
    <div className="space-y-3">
      <QuestionCard label="سؤال من الظرف" className="py-4">
        {log.text}
      </QuestionCard>
      {answer(me)}
      {answer(partner)}
      <p className="text-center text-[12px] text-dim">خدوا وقتكم واقروا إجابات بعض.</p>
    </div>
  );
}

/* ----------------------------- تحدي الدقيقة ----------------------------- */
function MinuteReveal({ me, partner, log }: GameProps & { log: MinuteLog }) {
  const column = (p: PlayerView) => (
    <div className="card p-3 animate-rise">
      <div className="mb-2 flex items-center gap-2">
        <Avatar avatar={p.avatar} color={p.color} size={30} />
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{p.name}</p>
        <span className={cn("num text-[20px] font-bold", log.count[p.seat] >= log.target ? "text-mint" : "text-cloud")}>
          {log.count[p.seat]}
        </span>
      </div>
      <ul className="space-y-1">
        {log.lists[p.seat].length === 0 && <li className="text-[13px] text-dim">ولا إجابة</li>}
        {log.lists[p.seat].map((e, i) => (
          <li key={i} className={cn("flex items-center gap-1.5 text-[14px]", e.st === "no" ? "text-rose line-through" : "text-cloud/90")}>
            {e.st === "no" ? <X className="size-3.5 shrink-0" /> : <Check className="size-3.5 shrink-0 text-mint" />}
            <span className="min-w-0 break-words">{e.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="space-y-3">
      <QuestionCard label={`الهدف كان ${log.target}`} className="py-4">
        {log.title}
      </QuestionCard>
      <div className="grid grid-cols-2 items-start gap-3">
        {column(me)}
        {column(partner)}
      </div>
    </div>
  );
}

/* ------------------------------ خمن الرسمة ------------------------------ */
function DrawReveal({ s, me, partner, log }: GameProps & { log: DrawLog }) {
  const artist = log.drawer === me.seat ? me : partner;
  const guesser = log.drawer === me.seat ? partner : me;
  return (
    <div className="space-y-3">
      <QuestionCard label={`رسمة ${artist.name}`} className="py-4">
        الكلمة كانت: <span className="text-gradient">{log.word}</span>
      </QuestionCard>
      <DrawPad key={`${s.id}:${log.turn}:replay`} sid={s.id} turn={log.turn} canDraw={false} replay />
      {log.solved ? (
        <Banner tone="good">
          {guesser.name} {gx(guesser, "خمّنها", "خمّنتها")} في <span className="num">{log.secs}</span> ثانية!
        </Banner>
      ) : (
        <Banner tone="bad">الوقت خلص ومحدش خمّنها</Banner>
      )}
      {log.solved && (
        <div className="grid grid-cols-2 gap-3 text-center">
          {[guesser, artist].map((p) => (
            <div key={p.seat} className="card flex items-center justify-center gap-2 py-3">
              <Avatar avatar={p.avatar} color={p.color} size={28} />
              <span className="num text-[18px] font-bold text-mint">+{log.pts[p.seat]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
