"use client";

import Link from "next/link";
import { Lock, Route, Unlock } from "lucide-react";
import { useRoomView } from "@/client/room";
import { Avatar } from "@/components/Avatar";
import { PageHeader, playerAt } from "@/components/room/bits";
import { BADGE_ICON, GAME_ICON } from "@/components/room/icons";
import { Chip, ProgressBar, Screen, SectionTitle } from "@/components/ui";
import { GAMES, isPlayable, levelInfo, WORLDS } from "@/game/catalog";
import { ACHIEVEMENTS, JOURNEY } from "@/game/progress";
import type { Seat } from "@/game/types";
import { cn } from "@/lib/cn";
import type { PlayerView, RoomView } from "@/server/contracts";

/** Screen 08 — badges, win record, unlocked games and what comes next. */
export default function AchievementsPage() {
  const view = useRoomView();
  if (!view.partner) return null;
  const players: PlayerView[] = [view.me, view.partner];
  const earnedCount = new Set(view.achievements.map((a) => a.key)).size;
  const level = levelInfo(view.shared);
  const stage = JOURNEY[view.journey];
  const openGames = WORLDS.filter((w) => view.unlocked.includes(w.id)).flatMap((w) => w.games.filter(isPlayable));
  const nextBadges = ACHIEVEMENTS.filter((a) => !view.achievements.some((x) => x.key === a.key)).slice(0, 2);

  return (
    <Screen className="pb-28 pt-6">
      <PageHeader title="الإنجازات" subtitle="كل اللي حققتوه سوا في مكان واحد." />

      {/* win record */}
      <section className="animate-rise">
        <SectionTitle
          action={
            <span className="text-[13px] text-mist">
              <b className="num text-cloud">{view.sessions}</b> جولة سوا
            </span>
          }
        >
          سجل الانتصارات
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {players.map((p) => (
            <div key={p.seat} className="card p-4">
              <div className="flex items-center gap-2.5">
                <Avatar avatar={p.avatar} color={p.color} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{p.name}</p>
                  <p className="truncate text-[11px] text-dim">{p.title}</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-1 text-center">
                <Stat label="فوز" value={p.stats.wins} tone="text-mint" />
                <Stat label="تعادل" value={p.stats.ties} tone="text-lavender" />
                <Stat label="خسارة" value={p.stats.losses} tone="text-mist" />
              </dl>
              <p className="mt-3 text-center text-[12px] text-mist">
                أطول سلسلة فوز: <b className="num text-cloud">{p.stats.bestStreak}</b>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* badges */}
      <section className="mt-8 animate-rise [animation-delay:80ms]">
        <SectionTitle
          action={
            <span className="num text-[13px] text-mist">
              {earnedCount} / {ACHIEVEMENTS.length}
            </span>
          }
        >
          الأوسمة
        </SectionTitle>
        <ul className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((def) => (
            <Badge key={def.key} def={def} view={view} />
          ))}
        </ul>
      </section>

      {/* unlocked games */}
      <section className="mt-8 animate-rise [animation-delay:140ms]">
        <SectionTitle>الألعاب المفتوحة</SectionTitle>
        <ul className="space-y-2">
          {openGames.map((id) => {
            const Icon = GAME_ICON[id];
            const plays = view.plays[id] ?? 0;
            return (
              <li key={id} className="card flex items-center gap-3 px-4 py-3">
                <Icon className="size-5 shrink-0 text-lavender" />
                <span className="flex-1 text-[15px] font-medium">{GAMES[id].name}</span>
                <span className="text-[12px] text-mist">
                  {plays === 0 ? "لسه متلعبتش" : <><span className="num text-cloud">{plays}</span> {plays === 1 ? "جولة" : plays <= 10 ? "جولات" : "جولة"}</>}
                </span>
                <Unlock className="size-4 shrink-0 text-mint" />
              </li>
            );
          })}
        </ul>
      </section>

      {/* what's next */}
      <section className="mt-8 animate-rise [animation-delay:200ms]">
        <SectionTitle>التحديات الجاية</SectionTitle>
        <div className="space-y-3">
          {level.next && (
            <div className="card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[15px] font-semibold">
                  <Lock className="size-4 text-lavender" />
                  افتحوا {level.next.name}
                </p>
                <span className="num text-[13px] text-mist">
                  {view.shared} / {level.next.at}
                </span>
              </div>
              <ProgressBar value={level.progress} className="h-1.5" />
            </div>
          )}
          {stage && (
            <Link href="/journey" className="card flex items-center gap-3 p-4 transition-colors hover:border-line-2">
              <Route className="size-5 shrink-0 text-lavender" />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">رحلتنا: {stage.name}</p>
                <p className="text-[13px] text-mist">{stage.desc}</p>
              </div>
            </Link>
          )}
          {nextBadges.map((def) => {
            const Icon = BADGE_ICON[def.icon];
            return (
              <div key={def.key} className="card flex items-center gap-3 p-4">
                <Icon className="size-5 shrink-0 text-lavender" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">وسام «{def.name}»</p>
                  <p className="text-[13px] text-mist">{def.desc}</p>
                </div>
                <Chip tone="amber">
                  <span className="num">+{def.reward}</span>
                </Chip>
              </div>
            );
          })}
        </div>
      </section>
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <dd className={cn("num text-[20px] font-bold leading-tight", tone)}>{value}</dd>
      <dt className="text-[11px] text-dim">{label}</dt>
    </div>
  );
}

function Badge({ def, view }: { def: (typeof ACHIEVEMENTS)[number]; view: RoomView }) {
  const Icon = BADGE_ICON[def.icon];
  const owners = view.achievements.filter((a) => a.key === def.key);
  const earned = owners.length > 0;
  return (
    <li className={cn("card relative flex flex-col items-center px-3 pb-4 pt-5 text-center", earned ? "border-violet/50" : "opacity-55")}>
      <span
        className={cn(
          "grid size-14 place-items-center rounded-full",
          earned
            ? "bg-[radial-gradient(circle_at_30%_25%,#b19aff,#8155ef_60%,#4b2fb0)] text-white shadow-[0_8px_24px_-6px_rgb(129_85_239/0.9)]"
            : "bg-white/6 text-dim",
        )}
      >
        <Icon className="size-7" />
      </span>
      <p className="mt-2.5 text-[14px] font-bold">{def.name}</p>
      <p className="mt-0.5 text-[12px] leading-5 text-mist">{def.desc}</p>
      <div className="mt-2 flex h-6 items-center gap-1.5">
        {earned ? (
          def.scope === "duo" ? (
            <Chip tone="mint">للثنائي</Chip>
          ) : (
            owners.map((o) => {
              const p = playerAt(view, o.to as Seat);
              return p ? <Avatar key={o.to} avatar={p.avatar} color={p.color} size={24} /> : null;
            })
          )
        ) : (
          <span className="text-[11px] text-dim">
            {def.scope === "duo" ? "وسام للثنائي" : "وسام فردي"} · <span className="num">+{def.reward}</span>
          </span>
        )}
      </div>
    </li>
  );
}
