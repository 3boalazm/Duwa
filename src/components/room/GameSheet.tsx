"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Layers, Send, Users } from "lucide-react";
import { errorMessage } from "@/client/api";
import { useRoom } from "@/client/room";
import { Button, Chip, Notice } from "@/components/ui";
import { GAMES, type PlayableGameId } from "@/game/catalog";
import { gx } from "@/game/profile";

import { GAME_ICON } from "./icons";
import { Sheet } from "./Sheet";

/** "How to play" + send the invite to the other player. */
export function GameSheet({ gameId, onClose }: { gameId: PlayableGameId | null; onClose: () => void }) {
  const { view, act } = useRoom();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!gameId || !view) return null;
  const game = GAMES[gameId];
  const Icon = GAME_ICON[gameId];
  const partner = view.partner;

  const invite = async () => {
    setBusy(true);
    setError(null);
    try {
      await act({ type: "propose", gameId });
      onClose();
      router.push("/play");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={busy ? undefined : onClose} labelledBy="game-title">
      <div className="pb-2">
        <div className="flex items-center gap-3.5">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-violet/20 text-lavender shadow-[inset_0_0_0_1px_rgb(129_85_239/0.5)]">
            <Icon className="size-7" />
          </span>
          <div className="min-w-0">
            <h2 id="game-title" className="text-[22px] font-bold">
              {game.name}
            </h2>
            <p className="text-[14px] text-mist">{game.tagline}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip>
            <Users className="size-3.5" />
            {game.mode === "coop" ? "تعاون" : "تنافس"}
          </Chip>
          <Chip tone="muted">
            <Layers className="size-3.5" />
            {game.rounds}
          </Chip>
          <Chip tone="muted">
            <Clock className="size-3.5" />
            {game.minutes}
          </Chip>
        </div>

        <ol className="mt-5 space-y-3">
          {game.how.map((step, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-7 text-cloud/90">
              <span className="num mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-violet/25 text-[12px] font-bold text-lavender">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        {partner && !partner.online && (
          <Notice tone="amber" className="mt-5">
            {partner.name} {gx(partner, "مش متصل", "مش متصلة")} دلوقتي. الدعوة هتظهر أول ما {gx(partner, "يفتح", "تفتح")} دُوّا.
          </Notice>
        )}
        {error && (
          <Notice tone="rose" className="mt-5">
            {error}
          </Notice>
        )}

        <Button block className="mt-6" loading={busy} onClick={invite}>
          <Send className="size-5 -scale-x-100" />
          {gx(view.me, "ابعت", "ابعتي")} دعوة{partner ? ` لـ${partner.name}` : ""}
        </Button>
      </div>
    </Sheet>
  );
}
