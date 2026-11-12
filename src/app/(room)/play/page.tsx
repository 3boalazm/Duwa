"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, WifiOff, X } from "lucide-react";
import { errorMessage } from "@/client/api";
import { useCountdown, useRoom, useRoomView } from "@/client/room";
import { Avatar } from "@/components/Avatar";
import { DrawGame } from "@/components/games/DrawGame";
import { EnvelopeGame } from "@/components/games/EnvelopeGame";
import { GuessGame } from "@/components/games/GuessGame";
import { MinuteGame } from "@/components/games/MinuteGame";
import { Hearts, NoYesGame } from "@/components/games/NoYesGame";
import { Results } from "@/components/games/Results";
import { Reveal } from "@/components/games/Reveal";
import type { GameProps } from "@/components/games/shared";
import { WordGame } from "@/components/games/WordGame";
import { GAME_ICON } from "@/components/room/icons";
import { Sheet } from "@/components/room/Sheet";
import { TimerRing } from "@/components/room/TimerRing";
import { Button, Dots, Screen } from "@/components/ui";
import { GAMES } from "@/game/catalog";
import type { SessionView } from "@/game/engine";
import { gx } from "@/game/profile";
import type { NoYesLog } from "@/game/types";
import type { NoYesView } from "@/game/views";
import { cn } from "@/lib/cn";
import type { PlayerView } from "@/server/contracts";

const ROUND_WORD: Record<string, string> = {
  guess: "السؤال",
  noyes: "السؤال",
  word: "الكلمة",
  envelope: "الظرف",
  minute: "التحدي",
  draw: "الرسمة",
};

/** Screens 06 + 07 — the round itself, from invitation to results. */
export default function PlayPage() {
  const view = useRoomView();
  const s = view.session;
  const partner = view.partner;
  if (!s || !partner) return <Screen />;

  const props: GameProps = { view, s, me: view.me, partner };

  if (s.phase === "invite") return <InviteWait {...props} />;
  if (s.phase === "countdown") return <Countdown {...props} />;
  if (s.phase === "done") {
    return (
      <Screen className="pb-10 pt-8">
        <Results {...props} />
      </Screen>
    );
  }

  return (
    <Screen className="pb-8 pt-4">
      <PlayHeader {...props} />
      <ScoreStrip {...props} />
      <main className="mt-5 flex-1">
        {s.phase === "reveal" ? (
          <>
            <Reveal {...props} />
            <NextBar {...props} />
          </>
        ) : (
          // a fresh component per round so inputs never leak between questions
          <div key={`${s.id}:${s.round}`}>
            <GameBody {...props} />
          </div>
        )}
      </main>
      {s.pause && <PausedSheet {...props} />}
    </Screen>
  );
}

function GameBody(props: GameProps) {
  switch (props.s.gameId) {
    case "guess":
      return <GuessGame {...props} />;
    case "noyes":
      return <NoYesGame {...props} />;
    case "word":
      return <WordGame {...props} />;
    case "envelope":
      return <EnvelopeGame {...props} />;
    case "minute":
      return <MinuteGame {...props} />;
    case "draw":
      return <DrawGame {...props} />;
  }
}

/* ------------------------------------------------------------------ */
/*  leaving                                                             */
/* ------------------------------------------------------------------ */
function useLeave() {
  const { act, toast } = useRoom();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const leave = async () => {
    setBusy(true);
    try {
      await act({ type: "leave" });
      router.replace("/home");
    } catch (err) {
      toast(errorMessage(err), "bad");
    } finally {
      setBusy(false);
    }
  };
  return { leave, busy };
}

/* ------------------------------------------------------------------ */
/*  invite sent — waiting for the other player                          */
/* ------------------------------------------------------------------ */
function InviteWait({ s, me, partner }: GameProps) {
  const { leave, busy } = useLeave();
  const game = GAMES[s.gameId];
  const Icon = GAME_ICON[s.gameId];
  const mine = s.host === me.seat;

  return (
    <Screen className="items-center justify-center pb-10 text-center">
      <div className="relative animate-pop">
        <Avatar avatar={partner.avatar} color={partner.color} size={104} online={partner.online} glow />
        <span className="absolute -inset-3 rounded-full border-2 border-violet/50 animate-breathe" aria-hidden />
        <span className="absolute -bottom-1 -start-2 grid size-10 place-items-center rounded-full border-2 border-midnight bg-violet text-white shadow-glow">
          <Icon className="size-5" />
        </span>
      </div>
      <h1 className="mt-8 text-[24px] font-bold">{game.name}</h1>
      {mine ? (
        <>
          <p className="mt-2 text-[15px] text-mist">
            الدعوة اتبعتت. مستنيين {partner.name} {gx(partner, "يوافق", "توافق")} <Dots className="ms-1 align-middle text-lavender" />
          </p>
          {!partner.online && (
            <p className="mt-3 max-w-[18rem] text-[13px] text-amber">
              {partner.name} {gx(partner, "مش متصل", "مش متصلة")} دلوقتي. الدعوة هتظهر أول ما {gx(partner, "يفتح", "تفتح")} دُوّا.
            </p>
          )}
          <Button variant="ghost" size="md" className="mt-8" loading={busy} onClick={leave}>
            إلغاء الدعوة
          </Button>
        </>
      ) : (
        <p className="mt-2 text-[15px] text-mist">دعوة لعب من {partner.name}…</p>
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/*  3 · 2 · 1                                                           */
/* ------------------------------------------------------------------ */
function Countdown({ s, me, partner }: GameProps) {
  const left = useCountdown(s.endsAt);
  const n = s.pause ? null : Math.max(1, Math.min(3, Math.ceil((left - 300) / 1000)));
  const game = GAMES[s.gameId];
  return (
    <Screen className="items-center justify-center pb-10 text-center">
      <p className="text-[14px] text-lavender">{game.name}</p>
      <div className="mt-6 flex items-center gap-5">
        <Avatar avatar={me.avatar} color={me.color} size={64} glow />
        <span className="font-latin text-[12px] font-bold tracking-[0.2em] text-dim">{game.mode === "coop" ? "&" : "VS"}</span>
        <Avatar avatar={partner.avatar} color={partner.color} size={64} glow />
      </div>
      <div className="mt-10 grid size-40 place-items-center rounded-full border border-violet/40 bg-violet/10 shadow-[0_0_60px_-10px_rgb(129_85_239/0.9)]">
        {n === null ? (
          <WifiOff className="size-12 text-amber" />
        ) : (
          <span key={n} className="num text-[84px] font-extrabold leading-none text-gradient animate-count">
            {n}
          </span>
        )}
      </div>
      <p className="mt-8 text-[16px] text-mist">
        {n === null ? `مستنيين ${partner.name} ${gx(partner, "يرجع", "ترجع")}…` : "جهّزوا نفسكم…"}
      </p>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/*  header + scores                                                     */
/* ------------------------------------------------------------------ */
function PlayHeader({ s, me }: GameProps) {
  const { leave, busy } = useLeave();
  const [asking, setAsking] = useState(false);
  const game = GAMES[s.gameId];
  return (
    <header className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label="الخروج من الجولة"
        className="grid size-10 shrink-0 place-items-center rounded-full border border-line-2 text-mist transition-colors hover:text-cloud"
      >
        <X className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-bold">{game.name}</p>
        <p className="text-[12px] text-mist">
          {ROUND_WORD[s.gameId]} <span className="num">{s.round + 1}</span> من <span className="num">{s.totalRounds}</span>
        </p>
      </div>
      <TimerRing endsAt={s.endsAt} totalMs={s.phaseMs} frozen={!!s.pause} />

      <Sheet open={asking} onClose={busy ? undefined : () => setAsking(false)} labelledBy="quit-title">
        <div className="pb-2">
          <h2 id="quit-title" className="text-[20px] font-bold">
            {gx(me, "تخرج", "تخرجي")} من الجولة؟
          </h2>
          <p className="mt-2 text-[15px] leading-7 text-mist">الجولة هتتقفل عليكم إنتوا الاتنين ومش هتتحسب لها نقاط.</p>
          <div className="mt-6 grid gap-2.5">
            <Button block onClick={() => setAsking(false)}>
              {gx(me, "كمّل", "كمّلي")} اللعب
            </Button>
            <Button block variant="danger" size="md" loading={busy} onClick={leave}>
              {gx(me, "اخرج", "اخرجي")} من الجولة
            </Button>
          </div>
        </div>
      </Sheet>
    </header>
  );
}

function ScoreStrip({ s, me, partner }: GameProps) {
  const coop = GAMES[s.gameId].mode === "coop";
  const lives = noYesLives(s);
  const partnerDone =
    s.phase === "play" && s.cur && "partnerDone" in s.cur ? s.cur.partnerDone : s.phase === "reveal" ? s.ready[partner.seat] : false;

  const side = (p: PlayerView, flip: boolean) => (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2.5", flip && "flex-row-reverse text-end")}>
      <Avatar avatar={p.avatar} color={p.color} size={40} online={p.seat === partner.seat ? p.online : undefined} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold">{p.seat === me.seat ? "إنت" : p.name}</p>
        {lives ? (
          <Hearts lives={lives[p.seat]} />
        ) : coop ? (
          <p className="text-[11px] text-dim">فريق واحد</p>
        ) : (
          <p className="num text-[15px] font-bold leading-tight text-lavender">{s.score[p.seat]}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="card mt-4 flex items-center gap-2 px-3 py-2.5" aria-label="النتيجة الحالية">
      {side(me, false)}
      <div className="shrink-0 px-1 text-center">
        {coop ? (
          <>
            <p className="num text-[20px] font-bold leading-none text-gradient">{s.team}</p>
            <p className="text-[10px] text-mist">توافق</p>
          </>
        ) : partnerDone ? (
          <Check className="size-5 text-mint" strokeWidth={3} aria-label={`${partner.name} ${gx(partner, "خلّص", "خلّصت")}`} />
        ) : (
          <span className="font-latin text-[10px] font-bold tracking-[0.18em] text-dim">VS</span>
        )}
      </div>
      {side(partner, true)}
    </div>
  );
}

function noYesLives(s: SessionView): [number, number] | null {
  if (s.gameId !== "noyes") return null;
  if (s.phase === "play" && s.cur?.g === "noyes") return (s.cur as NoYesView).lives;
  const last = s.log[s.log.length - 1] as NoYesLog | undefined;
  return last?.g === "noyes" ? last.lives : [3, 3];
}

/* ------------------------------------------------------------------ */
/*  reveal → next                                                       */
/* ------------------------------------------------------------------ */
function NextBar({ s, me, partner }: GameProps) {
  const { act, toast } = useRoom();
  const [busy, setBusy] = useState(false);
  const left = useCountdown(s.endsAt);
  const ready = s.ready[me.seat];
  const last = s.round + 1 >= s.totalRounds;

  const go = async () => {
    setBusy(true);
    try {
      await act({ type: "next" });
    } catch (err) {
      toast(errorMessage(err), "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sticky bottom-0 -mx-5 mt-5 bg-[linear-gradient(180deg,transparent,#090b18_35%)] px-5 pb-2 pt-8">
      <Button block disabled={ready} loading={busy} onClick={go}>
        {ready ? (
          <>
            مستنيين {partner.name} <Dots />
          </>
        ) : last ? (
          "شوفوا النتيجة"
        ) : (
          "التالي"
        )}
      </Button>
      <p className="mt-2 h-4 text-center text-[11px] text-dim">
        {s.pause
          ? ""
          : s.ready[partner.seat] && !ready
            ? `${partner.name} ${gx(partner, "جاهز", "جاهزة")}`
            : `هنكمّل لوحدنا خلال ${Math.ceil(left / 1000)} ثانية`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  the other player dropped                                            */
/* ------------------------------------------------------------------ */
function PausedSheet({ partner }: GameProps) {
  const { leave, busy } = useLeave();
  return (
    <Sheet open labelledBy="pause-title">
      <div className="flex flex-col items-center pb-2 text-center">
        <div className="relative">
          <Avatar avatar={partner.avatar} color={partner.color} size={72} online={false} />
          <span className="absolute -top-1 -end-1 grid size-8 place-items-center rounded-full border-2 border-navy bg-amber text-midnight">
            <WifiOff className="size-4" />
          </span>
        </div>
        <h2 id="pause-title" className="mt-4 text-[20px] font-bold">
          {partner.name} {gx(partner, "خرج", "خرجت")} من اللعبة لحظة
        </h2>
        <p className="mt-2 text-[15px] leading-7 text-mist">
          الوقت واقف والجولة محفوظة زي ما هي. أول ما {gx(partner, "يرجع", "ترجع")} هتكمّلوا من نفس المكان.
        </p>
        <p className="mt-4 flex items-center gap-2 text-[14px] text-lavender" role="status">
          {gx(partner, "مستنيينه يرجع", "مستنيينها ترجع")} <Dots />
        </p>
        <Button variant="ghost" size="md" className="mt-5" loading={busy} onClick={leave}>
          إنهاء الجولة من غير نقاط
        </Button>
      </div>
    </Sheet>
  );
}
