"use client";

import { useState } from "react";
import { Check, Lock, Play, Sparkles } from "lucide-react";
import { useRoomView } from "@/client/room";
import { PageHeader } from "@/components/room/bits";
import { GameSheet } from "@/components/room/GameSheet";
import { Button, Chip, ProgressBar, Screen } from "@/components/ui";
import { GAMES, type PlayableGameId, POINTS, WORLDS } from "@/game/catalog";
import { JOURNEY } from "@/game/progress";
import { cn } from "@/lib/cn";

/** Screen 09 — «رحلتنا»: co-op missions in order; finishing one opens the next. */
export default function JourneyPage() {
  const view = useRoomView();
  const [sheet, setSheet] = useState<PlayableGameId | null>(null);
  const done = view.journey;
  const total = JOURNEY.length;

  return (
    <Screen className="pb-28 pt-6">
      <PageHeader title="رحلتنا" subtitle="مهمات بتتعمل سوا. كل محطة بتفتح اللي بعدها." />

      <div className="card-glow mb-7 p-4 animate-rise">
        <div className="mb-2 flex items-center justify-between text-[14px]">
          <span className="font-semibold">
            {done >= total ? "وصلتوا لآخر الرحلة!" : `المحطة ${Math.min(done + 1, total)} من ${total}`}
          </span>
          <span className="text-mist">
            كل محطة <b className="num text-lavender">+{POINTS.journey}</b> للرصيد المشترك
          </span>
        </div>
        <ProgressBar value={done / total} />
      </div>

      <ol className="relative">
        {JOURNEY.map((stage, i) => {
          const state = i < done ? "done" : i === done ? "current" : "locked";
          const game = stage.game ? GAMES[stage.game] : null;
          const gameOpen = stage.game
            ? view.unlocked.includes(WORLDS.find((w) => w.games.includes(stage.game!))!.id)
            : false;
          return (
            <li key={stage.key} className="relative flex gap-4 pb-6 last:pb-0 animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
              {/* the path */}
              {i < total - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute start-[21px] top-11 bottom-0 w-0.5 rounded-full",
                    i < done ? "bg-[linear-gradient(180deg,#4fe3b0,#8155ef)]" : "bg-line-2",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 grid size-11 shrink-0 place-items-center rounded-full border-2 text-[15px] font-bold",
                  state === "done" && "border-mint bg-mint/15 text-mint",
                  state === "current" && "border-violet bg-violet/25 text-cloud shadow-glow",
                  state === "locked" && "border-line-2 bg-navy text-dim",
                )}
              >
                {state === "done" ? <Check className="size-5" strokeWidth={3} /> : state === "locked" ? <Lock className="size-4" /> : <span className="num">{i + 1}</span>}
                {state === "current" && <span className="absolute inset-0 rounded-full border-2 border-violet animate-breathe" aria-hidden />}
              </span>

              <div className={cn("card min-w-0 flex-1 p-4", state === "current" && "border-violet/60", state === "locked" && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-bold">{stage.name}</h2>
                  {state === "done" && <Chip tone="mint">تمت</Chip>}
                  {state === "current" && (
                    <Chip>
                      <Sparkles className="size-3" />
                      المحطة الحالية
                    </Chip>
                  )}
                </div>
                <p className="mt-1 text-[13px] leading-6 text-mist">{stage.desc}</p>
                {state === "current" && game && stage.game && (
                  gameOpen ? (
                    <Button size="sm" className="mt-3" onClick={() => setSheet(stage.game!)}>
                      <Play className="size-3.5 -scale-x-100 fill-current" />
                      العبوا {game.name}
                    </Button>
                  ) : (
                    <p className="mt-2 text-[12px] text-amber">اللعبة دي لسه مقفولة — جمّعوا نقاط أكتر الأول.</p>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-center text-[12px] text-dim">محطات جديدة هتنضاف مع كل لعبة جديدة.</p>
      <GameSheet gameId={sheet} onClose={() => setSheet(null)} />
    </Screen>
  );
}
