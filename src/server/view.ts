import { WORLDS, worldUnlocked } from "@/game/catalog";
import { sessionView } from "@/game/engine";
import type { PlayerState, RoomAgg, Seat } from "@/game/types";
import { other } from "@/game/types";
import type { PlayerView, RoomView } from "./contracts";

function playerView(p: PlayerState, now: number): PlayerView {
  return {
    seat: p.seat,
    name: p.name,
    gender: p.gender,
    avatar: p.avatar,
    color: p.color,
    title: p.title,
    points: p.points,
    online: p.seenUntil > now,
    stats: p.stats,
  };
}

/** The room as one specific player is allowed to see it. */
export function buildView(agg: RoomAgg, seat: Seat, now: number): RoomView {
  const me = agg.players[seat];
  if (!me) throw new Error("player missing from room");
  const partner = agg.players[other(seat)];
  const recorded = agg.unlocks.map((u) => u.world);
  return {
    code: agg.code,
    me: { ...playerView(me, now), online: true },
    partner: partner ? playerView(partner, now) : null,
    shared: agg.shared,
    unlocked: WORLDS.filter((w) => worldUnlocked(w, agg.shared, recorded)).map((w) => w.id),
    plays: agg.progress.plays,
    sessions: agg.progress.sessions,
    journey: agg.progress.journey,
    achievements: agg.achievements,
    last: agg.progress.last,
    flash: agg.progress.flash,
    session: agg.session ? sessionView(agg.session, seat) : null,
  };
}
