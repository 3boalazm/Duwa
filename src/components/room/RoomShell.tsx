"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { WifiOff } from "lucide-react";
import { errorMessage } from "@/client/api";
import { useRoom } from "@/client/room";
import { Avatar } from "@/components/Avatar";
import { LogoHero } from "@/components/Logo";
import { Button, Chip, Screen } from "@/components/ui";
import { GAMES } from "@/game/catalog";
import { BottomNav } from "./BottomNav";
import { GAME_ICON } from "./icons";
import { Sheet } from "./Sheet";

const NO_NAV = ["/play", "/lobby"];

export function RoomShell({ children }: { children: ReactNode }) {
  const { view, status } = useRoom();
  const pathname = usePathname();

  if (!view) {
    return (
      <Screen className="items-center justify-center text-center">
        <LogoHero size={92} />
        <p className="mt-2 text-[15px] text-mist">{status === "reconnecting" ? "بنحاول نوصل للغرفة…" : "بنفتح عالمكم…"}</p>
      </Screen>
    );
  }

  const showNav = !!view.partner && !NO_NAV.includes(pathname);
  return (
    <>
      {status === "reconnecting" && (
        <div
          className="fixed inset-x-0 top-0 z-[55] mx-auto flex w-full max-w-[460px] items-center justify-center gap-2 bg-amber/95 px-4 pb-1.5 text-[13px] font-semibold text-midnight"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.375rem)" }}
        >
          <WifiOff className="size-4" />
          الاتصال ضعيف… بنحاول نرجّعه
        </div>
      )}
      {children}
      {showNav && <BottomNav />}
      <IncomingInvite />
    </>
  );
}

/** The other player wants to play: shown on top of whatever screen you are on. */
function IncomingInvite() {
  const { view, act, toast } = useRoom();
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const s = view?.session;
  const open = !!view && !!s && s.phase === "invite" && s.host !== view.me.seat;
  if (!open || !view?.partner || !s) return null;

  const game = GAMES[s.gameId];
  const Icon = GAME_ICON[s.gameId];
  const answer = async (accept: boolean) => {
    setBusy(accept ? "yes" : "no");
    try {
      await act({ type: "respond", accept });
    } catch (err) {
      toast(errorMessage(err), "bad");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open labelledBy="invite-title">
      <div className="flex flex-col items-center pb-2 text-center">
        <div className="relative">
          <Avatar avatar={view.partner.avatar} color={view.partner.color} size={76} glow />
          <span className="absolute -bottom-1 -end-2 grid size-9 place-items-center rounded-full border-2 border-navy bg-violet text-white shadow-glow">
            <Icon className="size-[18px]" />
          </span>
        </div>
        <p className="mt-4 text-[14px] text-mist">دعوة لعب من {view.partner.name}</p>
        <h2 id="invite-title" className="mt-1 text-[24px] font-bold">
          {game.name}
        </h2>
        <p className="mt-1.5 text-[14px] text-mist">{game.tagline}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Chip>{game.mode === "coop" ? "تعاون" : "تنافس"}</Chip>
          <Chip tone="muted">{game.rounds}</Chip>
          <Chip tone="muted">{game.minutes}</Chip>
        </div>
        <div className="mt-6 grid w-full gap-2.5">
          <Button block loading={busy === "yes"} disabled={busy !== null} onClick={() => answer(true)}>
            يلا نلعب
          </Button>
          <Button block variant="ghost" size="md" loading={busy === "no"} disabled={busy !== null} onClick={() => answer(false)}>
            مش دلوقتي
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
