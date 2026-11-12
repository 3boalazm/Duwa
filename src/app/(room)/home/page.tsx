"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Dices, Lock, Play, Route } from "lucide-react";
import { useRoom, useRoomView } from "@/client/room";
import { relativeTime } from "@/client/share";
import { Avatar } from "@/components/Avatar";
import { BrandRow } from "@/components/Logo";
import { outcomeLine, Points } from "@/components/room/bits";
import { GameSheet } from "@/components/room/GameSheet";
import { GAME_ICON } from "@/components/room/icons";
import { WorldOrb } from "@/components/room/WorldArt";
import { Button, buttonClass, Chip, ProgressBar, Screen, SectionTitle } from "@/components/ui";
import { GAMES, isPlayable, levelInfo, type PlayableGameId, WORLDS } from "@/game/catalog";
import { gx } from "@/game/profile";
import { JOURNEY } from "@/game/progress";
import type { PlayerView, RoomView } from "@/server/contracts";

/** Screen 04 — home: the two players, their points, and where to go next. */
export default function HomePage() {
  const view = useRoomView();
  const { now } = useRoom();
  const [sheet, setSheet] = useState<PlayableGameId | null>(null);
  const partner = view.partner;
  if (!partner) return null;

  const level = levelInfo(view.shared);
  const stage = JOURNEY[view.journey];

  const surprise = () => {
    const open = WORLDS.filter((w) => view.unlocked.includes(w.id)).flatMap((w) => w.games.filter(isPlayable));
    if (open.length) setSheet(open[Math.floor(Math.random() * open.length)]);
  };

  return (
    <Screen className="pb-28 pt-5">
      <header className="mb-5 flex items-center justify-between">
        <BrandRow />
        <Chip tone={partner.online ? "mint" : "muted"}>
          <span className={`size-1.5 rounded-full ${partner.online ? "bg-mint" : "bg-dim"}`} />
          {partner.name} {partner.online ? gx(partner, "متصل", "متصلة") : gx(partner, "مش متصل", "مش متصلة")}
        </Chip>
      </header>

      {/* the pair + shared balance */}
      <section className="card-glow px-4 pb-5 pt-5 animate-rise" aria-label="رصيد الثنائي">
        <div className="flex items-start justify-between gap-2">
          <PlayerColumn player={view.me} />
          <div className="flex min-w-0 flex-1 flex-col items-center pt-1 text-center">
            <p className="text-[12px] text-mist">الرصيد المشترك</p>
            <Points value={view.shared} size="lg" className="text-gradient leading-[1.15]" />
            <p className="-mt-0.5 font-latin text-[9px] font-semibold tracking-[0.2em] text-lavender/80">DUWA POINTS</p>
          </div>
          <PlayerColumn player={partner} showOnline />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <span className="font-semibold text-cloud">
              المستوى {level.index + 1} · {level.name}
            </span>
            {level.next && (
              <span className="num text-mist">
                {view.shared} / {level.next.at}
              </span>
            )}
          </div>
          <ProgressBar value={level.progress} />
          <p className="mt-2 text-[13px] text-mist">
            {level.next ? (
              <>
                باقي <b className="num font-bold text-lavender">{level.next.remaining}</b> نقطة لفتح {level.next.name}
              </>
            ) : (
              "فتحتوا كل العوالم. العالم كله بتاعكم!"
            )}
          </p>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 animate-rise [animation-delay:70ms]">
        <Link href="/worlds" className={buttonClass("primary", "lg")}>
          <Play className="size-5 -scale-x-100 fill-current" />
          ابدأ اللعب
        </Link>
        <Button variant="soft" onClick={surprise} aria-label="مفاجأة عشوائية: اختار لنا لعبة">
          <Dices className="size-5 text-lavender" />
          مفاجأة
        </Button>
      </div>

      {/* journey teaser */}
      <Link
        href="/journey"
        className="card mt-6 flex items-center gap-3.5 p-4 transition-colors hover:border-line-2 animate-rise [animation-delay:120ms]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet/20 text-lavender">
          <Route className="size-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-mist">
            رحلتنا · المحطة <span className="num">{Math.min(view.journey + 1, JOURNEY.length)}</span> من{" "}
            <span className="num">{JOURNEY.length}</span>
          </p>
          <p className="truncate text-[15px] font-semibold">{stage ? stage.name : "خلّصتوا كل المحطات!"}</p>
          <ProgressBar value={view.journey / JOURNEY.length} className="mt-2 h-1.5" />
        </div>
        <ChevronLeft className="size-5 shrink-0 text-dim" />
      </Link>

      {/* worlds */}
      <section className="mt-7 animate-rise [animation-delay:170ms]">
        <SectionTitle
          action={
            <Link href="/worlds" className="text-[13px] text-lavender">
              كل العوالم
            </Link>
          }
        >
          العوالم الستة
        </SectionTitle>
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
          {WORLDS.map((w) => {
            const open = view.unlocked.includes(w.id);
            return (
              <Link
                key={w.id}
                href={open ? `/worlds/${w.id}` : "/worlds"}
                className="card flex w-[118px] shrink-0 flex-col items-center px-2 py-4 text-center transition-transform active:scale-95"
              >
                <WorldOrb world={w} locked={!open} size={52} />
                <p className="mt-2.5 text-[14px] font-semibold">{w.short}</p>
                {open ? (
                  <p className="text-[12px] text-mint">مفتوح</p>
                ) : (
                  <p className="flex items-center gap-1 text-[12px] text-dim">
                    <Lock className="size-3" />
                    <span className="num">{w.threshold}</span>
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* last round */}
      <section className="mt-7 animate-rise [animation-delay:220ms]">
        <SectionTitle>آخر جولة</SectionTitle>
        {view.last ? (
          <LastRound view={view} now={now()} />
        ) : (
          <div className="card p-4 text-[14px] text-mist">لسه ملعبتوش ولا جولة. أول جولة عليها مكافأة!</div>
        )}
      </section>

      <GameSheet gameId={sheet} onClose={() => setSheet(null)} />
    </Screen>
  );

}

function LastRound({ view, now }: { view: RoomView; now: number }) {
  const last = view.last;
  if (!last) return null;
  const Icon = GAME_ICON[last.gameId];
  return (
    <div className="card flex items-center gap-3.5 p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/6 text-lavender">
        <Icon className="size-[22px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{GAMES[last.gameId].name}</p>
        <p className="truncate text-[13px] text-mist">{outcomeLine(view, last)}</p>
      </div>
      <span className="shrink-0 text-[12px] text-dim">{relativeTime(last.finishedAt, now)}</span>
    </div>
  );
}

function PlayerColumn({ player, showOnline }: { player: PlayerView; showOnline?: boolean }) {
  return (
    <div className="flex w-[92px] shrink-0 flex-col items-center text-center">
      <Avatar avatar={player.avatar} color={player.color} size={62} online={showOnline ? player.online : undefined} glow />
      <p className="mt-2 w-full truncate text-[15px] font-semibold">{player.name}</p>
      <p className="w-full truncate text-[11px] text-dim">{player.title}</p>
      <p className="mt-1 text-[13px] text-mist">
        <Points value={player.points} size="sm" className="text-cloud" /> نقطة
      </p>
    </div>
  );
}
