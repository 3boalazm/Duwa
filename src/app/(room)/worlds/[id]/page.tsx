"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, Clock, Hourglass, Layers, Play } from "lucide-react";
import { useRoomView } from "@/client/room";
import { GameSheet } from "@/components/room/GameSheet";
import { GAME_ICON } from "@/components/room/icons";
import { WorldOrb } from "@/components/room/WorldArt";
import { Button, Chip, Screen } from "@/components/ui";
import { GAMES, isPlayable, type PlayableGameId, WORLDS } from "@/game/catalog";

/** A world's games: pick an open one and invite the other player. */
export default function WorldPage() {
  const view = useRoomView();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const world = WORLDS.find((w) => w.id === params.id);
  const open = !!world && view.unlocked.includes(world.id);
  const [sheet, setSheet] = useState<PlayableGameId | null>(null);

  useEffect(() => {
    if (!world || !open) router.replace("/worlds");
  }, [world, open, router]);

  if (!world || !open) return null;

  return (
    <Screen className="pb-28 pt-5">
      <button
        type="button"
        onClick={() => router.push("/worlds")}
        className="mb-4 inline-flex items-center gap-1 self-start rounded-full py-1 pe-3 text-[14px] text-mist transition-colors hover:text-cloud"
      >
        <ChevronRight className="size-5" />
        كل العوالم
      </button>

      <header className="mb-6 flex items-center gap-4 animate-rise">
        <WorldOrb world={world} size={76} />
        <div className="min-w-0">
          <h1 className="text-[24px] font-bold">{world.name}</h1>
          <p className="text-[14px] text-mist">{world.blurb}</p>
        </div>
      </header>

      {world.games.length === 0 && (
        <div className="card p-5 text-center text-[15px] text-mist animate-rise">
          العالم السري اتفتح! ألعابه ومهماته الخاصة جاية في تحديث قريب.
        </div>
      )}

      <ul className="stagger space-y-3">
        {world.games.map((id, i) => {
          const game = GAMES[id];
          const Icon = GAME_ICON[id];
          const plays = view.plays[id] ?? 0;
          return (
            <li key={id} style={{ "--i": i } as React.CSSProperties} className={`card p-4 ${game.playable ? "" : "opacity-70"}`}>
              <div className="flex items-start gap-3.5">
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
                    game.playable ? "bg-violet/20 text-lavender shadow-[inset_0_0_0_1px_rgb(129_85_239/0.45)]" : "bg-white/5 text-dim"
                  }`}
                >
                  <Icon className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[17px] font-bold">{game.name}</h2>
                    <Chip tone={game.playable ? "violet" : "muted"}>{game.kind}</Chip>
                  </div>
                  <p className="mt-1 text-[13px] leading-6 text-mist">{game.tagline}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-dim">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="size-3.5" />
                      {game.rounds}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {game.minutes}
                    </span>
                    <span>{game.mode === "coop" ? "تعاون" : "تنافس"}</span>
                    {plays > 0 && (
                      <span className="text-mint">
                        لعبتوها <span className="num">{plays}</span> {plays === 1 ? "مرة" : plays <= 10 ? "مرات" : "مرة"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {isPlayable(id) ? (
                <Button block size="md" className="mt-3.5" onClick={() => setSheet(id)}>
                  <Play className="size-4 -scale-x-100 fill-current" />
                  العب
                </Button>
              ) : (
                <p className="mt-3.5 flex items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-line-2 py-2.5 text-[13px] text-mist">
                  <Hourglass className="size-4" />
                  جاية في تحديث قريب
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <GameSheet gameId={sheet} onClose={() => setSheet(null)} />
    </Screen>
  );
}
