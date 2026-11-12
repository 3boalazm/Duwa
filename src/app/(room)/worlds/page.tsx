"use client";

import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import { useRoomView } from "@/client/room";
import { PageHeader, Points } from "@/components/room/bits";
import { WorldOrb } from "@/components/room/WorldArt";
import { Chip, ProgressBar, Screen } from "@/components/ui";
import { GAMES, type World, WORLDS } from "@/game/catalog";
import type { RoomView } from "@/server/contracts";

/** Screen 05 — the six worlds: open or locked, games inside, points needed, progress. */
export default function WorldsPage() {
  const view = useRoomView();
  return (
    <Screen className="pb-28 pt-6">
      <PageHeader
        title="عوالم الألعاب"
        subtitle="الرصيد المشترك هو اللي بيفتح العوالم."
        action={
          <div className="shrink-0 text-end">
            <Points value={view.shared} className="text-[22px] text-gradient" />
            <p className="text-[11px] text-mist">نقطة مشتركة</p>
          </div>
        }
      />
      <ul className="stagger space-y-3.5">
        {WORLDS.map((w, i) => (
          <li key={w.id} style={{ "--i": i } as React.CSSProperties}>
            <WorldCard world={w} view={view} />
          </li>
        ))}
      </ul>
    </Screen>
  );
}

function WorldCard({ world, view }: { world: World; view: RoomView }) {
  const open = view.unlocked.includes(world.id);
  const ready = world.games.filter((g) => GAMES[g].playable).length;
  const total = world.games.length;
  const played = world.games.filter((g) => (view.plays[g] ?? 0) > 0).length;

  const body = (
    <div
      className="card relative overflow-hidden p-4"
      style={
        open
          ? { backgroundImage: `radial-gradient(120% 140% at 100% 0%, ${world.hue[1]}2e, transparent 55%), linear-gradient(180deg, rgb(31 26 58 / 0.92), rgb(23 19 43 / 0.92))` }
          : undefined
      }
    >
      <div className="flex items-center gap-4">
        <WorldOrb world={world} locked={!open} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold leading-snug">{world.name}</h2>
          <p className="mt-0.5 text-[13px] text-mist">{world.blurb}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {open ? <Chip tone="mint">مفتوح</Chip> : <Chip tone="muted"><Lock className="size-3" />مغلق</Chip>}
            <Chip tone="muted">
              {total === 0 ? "ألعاب سرية" : ready === total ? `${total} ألعاب` : ready === 0 ? `${total} ألعاب قريبًا` : `${ready} متاحة من ${total}`}
            </Chip>
          </div>
        </div>
        {open && <ChevronLeft className="size-5 shrink-0 text-dim" />}
      </div>

      <div className="mt-4">
        {open ? (
          <>
            <div className="mb-1.5 flex justify-between text-[12px] text-mist">
              <span>تقدمكم في العالم</span>
              <span className="num">
                {played} / {Math.max(ready, 1)}
              </span>
            </div>
            <ProgressBar value={ready ? played / ready : 0} tone="mint" className="h-1.5" />
          </>
        ) : (
          <>
            <div className="mb-1.5 flex justify-between text-[12px] text-mist">
              <span>
                محتاجين <b className="num font-bold text-lavender">{world.threshold}</b> نقطة مشتركة
              </span>
              <span className="num">
                {view.shared} / {world.threshold}
              </span>
            </div>
            <ProgressBar value={view.shared / world.threshold} className="h-1.5" />
            <p className="mt-1.5 text-[12px] text-dim">
              باقي <span className="num">{world.threshold - view.shared}</span> نقطة ويتفتح لوحده.
            </p>
          </>
        )}
      </div>
    </div>
  );

  return open ? (
    <Link href={`/worlds/${world.id}`} className="block transition-transform active:scale-[0.985]">
      {body}
    </Link>
  ) : (
    <div aria-disabled="true">{body}</div>
  );
}
