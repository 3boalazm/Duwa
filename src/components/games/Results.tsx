"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, House, RotateCcw, Unlock } from "lucide-react";
import { errorMessage } from "@/client/api";
import { useRoom } from "@/client/room";
import { Avatar } from "@/components/Avatar";
import { Confetti } from "@/components/room/Confetti";
import { BADGE_ICON } from "@/components/room/icons";
import { WorldOrb } from "@/components/room/WorldArt";
import { Button, buttonClass, Chip, ProgressBar } from "@/components/ui";
import { GAMES, levelInfo, WORLDS } from "@/game/catalog";
import { achievementByKey, JOURNEY } from "@/game/progress";
import { gx } from "@/game/profile";
import type { Award, Owner } from "@/game/types";
import { cn } from "@/lib/cn";
import type { PlayerView } from "@/server/contracts";
import type { GameProps } from "./shared";

/** Screen 07 — results: who won, what was earned, and anything newly unlocked. */
export function Results({ s, me, partner }: GameProps) {
  const { act, toast } = useRoom();
  const [busy, setBusy] = useState(false);
  const r = s.result;
  if (!r) return null;

  const game = GAMES[r.gameId];
  const iWon = r.winner === me.seat;
  const tie = !r.coop && r.winner === null;
  const celebrate = r.coop ? r.awards.some((a) => a.reason === "team") : r.winner !== null;
  const level = levelInfo(r.sharedAfter);
  const mine = gx(me, "ليك", "ليكي");
  const who = (to: Owner) => (to === 2 ? "للرصيد المشترك" : to === me.seat ? mine : `لـ${partner.name}`);

  const title = r.coop
    ? r.headline
    : tie
      ? "تعادل!"
      : iWon
        ? gx(me, "كسبت الجولة!", "كسبتي الجولة!")
        : `${partner.name} ${gx(partner, "كسب", "كسبت")} الجولة`;
  const subtitle = r.coop
    ? "لعبتوا كفريق واحد"
    : tie
      ? "محدش أحسن من التاني المرة دي"
      : iWon
        ? gx(me, "برافو عليك", "برافو عليكي")
        : `الجولة الجاية ${mine} — ومفيش نقاط بتتخصم`;

  const again = async () => {
    setBusy(true);
    try {
      await act({ type: "propose", gameId: r.gameId });
    } catch (err) {
      toast(errorMessage(err), "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      {celebrate && <Confetti />}

      <header className="text-center animate-rise">
        <p className="text-[13px] text-lavender">{game.name}</p>
        <h1 className="mt-1 text-[28px] font-bold">{title}</h1>
        <p className="mt-1 text-[14px] text-mist">{subtitle}</p>
      </header>

      {/* the two players */}
      <section className="card-glow flex items-center justify-around px-3 py-5 animate-pop" aria-label="نتيجة الجولة">
        <ResultPlayer player={me} label="إنت" score={r.coop ? null : r.score[me.seat]} winner={!r.coop && r.winner === me.seat} earned={r.earned[me.seat]} />
        <div className="text-center">
          {r.coop ? (
            <>
              <p className="num text-[34px] font-bold leading-none text-gradient">{r.team}</p>
              <p className="mt-1 text-[12px] text-mist">نقاط توافق</p>
            </>
          ) : (
            <span className="font-latin text-[13px] font-bold tracking-[0.2em] text-dim">VS</span>
          )}
        </div>
        <ResultPlayer
          player={partner}
          label={partner.name}
          score={r.coop ? null : r.score[partner.seat]}
          winner={!r.coop && r.winner === partner.seat}
          earned={r.earned[partner.seat]}
        />
      </section>

      {/* points */}
      <section className="card p-4 animate-rise [animation-delay:120ms]">
        <h2 className="mb-3 text-[16px] font-bold">النقاط المكتسبة</h2>
        <ul className="space-y-2.5">
          {r.awards.map((a: Award, i) => (
            <li key={i} className="flex items-center gap-3 text-[14px]">
              <span className="min-w-0 flex-1 truncate text-cloud/90">{a.label}</span>
              <span className={cn("shrink-0 text-[12px]", a.to === 2 ? "text-lavender" : a.to === me.seat ? "text-mint" : "text-mist")}>
                {who(a.to)}
              </span>
              <span className="num w-10 shrink-0 text-end text-[15px] font-bold text-cloud">+{a.points}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* shared balance */}
      <section className="card p-4 animate-rise [animation-delay:180ms]">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] text-mist">الرصيد المشترك</p>
            <p className="text-[30px] font-bold leading-tight text-gradient">
              <CountUp from={r.sharedBefore} to={r.sharedAfter} />
            </p>
          </div>
          <Chip tone="mint">
            <span className="num">+{r.sharedAfter - r.sharedBefore}</span>
          </Chip>
        </div>
        <ProgressBar value={level.progress} className="mt-3" />
        <p className="mt-2 text-[13px] text-mist">
          {level.next ? (
            <>
              باقي <b className="num text-lavender">{level.next.remaining}</b> نقطة لفتح {level.next.name}
            </>
          ) : (
            "كل العوالم مفتوحة!"
          )}
        </p>
      </section>

      {/* unlocks */}
      {r.unlocked.map((id) => {
        const world = WORLDS.find((w) => w.id === id);
        if (!world) return null;
        return (
          <Link
            key={id}
            href={`/worlds/${id}`}
            className="card-glow flex items-center gap-4 p-4 animate-pop [animation-delay:260ms]"
          >
            <WorldOrb world={world} size={60} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-mint">
                <Unlock className="size-4" />
                اتفتح عالم جديد!
              </p>
              <p className="truncate text-[19px] font-bold">{world.name}</p>
              <p className="truncate text-[13px] text-mist">{world.blurb}</p>
            </div>
          </Link>
        );
      })}

      {/* badges + journey */}
      {(r.achievements.length > 0 || r.journey.length > 0) && (
        <section className="card p-4 animate-rise [animation-delay:300ms]">
          <h2 className="mb-3 text-[16px] font-bold">إنجازات جديدة</h2>
          <ul className="space-y-3">
            {r.achievements.map((a) => {
              const def = achievementByKey(a.key);
              if (!def) return null;
              const Icon = BADGE_ICON[def.icon];
              return (
                <li key={`${a.key}-${a.to}`} className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#b19aff,#8155ef_60%,#4b2fb0)] text-white shadow-[0_8px_20px_-6px_rgb(129_85_239/0.9)]">
                    <Icon className="size-[22px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold">{def.name}</p>
                    <p className="truncate text-[12px] text-mist">{def.desc}</p>
                  </div>
                  <span className="shrink-0 text-[12px] text-lavender">{a.to === 2 ? "للثنائي" : a.to === me.seat ? mine : partner.name}</span>
                </li>
              );
            })}
            {r.journey.map((key) => {
              const stage = JOURNEY.find((j) => j.key === key);
              if (!stage) return null;
              return (
                <li key={key} className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-mint bg-mint/15 text-[13px] font-bold text-mint">
                    <span className="num">{JOURNEY.indexOf(stage) + 1}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold">رحلتنا: {stage.name}</p>
                    <p className="text-[12px] text-mist">محطة اكتملت — المحطة اللي بعدها اتفتحت.</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 pt-1">
        <Button loading={busy} onClick={again}>
          <RotateCcw className="size-5" />
          العب تاني
        </Button>
        <Link href="/home" className={buttonClass("soft", "lg")}>
          <House className="size-5" />
          الرئيسية
        </Link>
      </div>
    </div>
  );
}

function ResultPlayer({
  player,
  label,
  score,
  winner,
  earned,
}: {
  player: PlayerView;
  label: string;
  score: number | null;
  winner: boolean;
  earned: number;
}) {
  return (
    <div className="flex w-[112px] flex-col items-center text-center">
      <div className="relative">
        {winner && (
          <Crown className="absolute -top-6 left-1/2 size-7 -translate-x-1/2 fill-amber text-amber drop-shadow-[0_0_10px_rgb(255_198_92/0.8)] animate-float" />
        )}
        <Avatar avatar={player.avatar} color={player.color} size={72} glow={winner} />
      </div>
      <p className="mt-2 w-full truncate text-[15px] font-semibold">{label}</p>
      {score !== null && <p className="num text-[28px] font-bold leading-tight">{score}</p>}
      <p className="mt-0.5 text-[12px] text-mint">
        <span className="num font-bold">+{earned}</span> نقطة
      </p>
    </div>
  );
}

const prefersCalm = () =>
  typeof document !== "undefined" &&
  (document.documentElement.dataset.motion === "off" || window.matchMedia("(prefers-reduced-motion: reduce)").matches);

/** Counts from one number to another (the shared balance growing). */
function CountUp({ from, to }: { from: number; to: number }) {
  const [value, setValue] = useState(() => (prefersCalm() ? to : from));
  useEffect(() => {
    if (from === to || prefersCalm()) return;
    let raf = 0;
    const start = performance.now() + 500;
    const run = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - start) / 1100));
      setValue(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return <span className="num">{value}</span>;
}
