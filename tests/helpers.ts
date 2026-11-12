import type { Ctx, PlayerState, RoomAgg, Seat } from "@/game/types";
import { emptyEffects, emptyProgress, emptyStats } from "@/game/types";

/** Deterministic pseudo-random generator so engine tests are repeatable. */
export function seeded(seed = 1): () => number {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

export function makePlayer(seat: Seat, name: string): PlayerState {
  return {
    id: `p${seat}`,
    seat,
    name,
    gender: seat === 0 ? "f" : "m",
    avatar: seat === 0 ? "cat" : "fox",
    color: seat === 0 ? "violet" : "mint",
    title: "الأسطورة",
    points: 0,
    stats: emptyStats(),
    seenUntil: Number.MAX_SAFE_INTEGER,
  };
}

export function makeRoom(opts: { shared?: number; solo?: boolean } = {}): RoomAgg {
  return {
    id: "room1",
    code: "ABCDEF",
    version: 1,
    shared: opts.shared ?? 0,
    progress: emptyProgress(),
    players: [makePlayer(0, "سارة"), opts.solo ? null : makePlayer(1, "مصطفى")],
    session: null,
    achievements: [],
    unlocks: [],
  };
}

export function makeCtx(now = 1_000_000, seed = 7): Ctx & { advance: (ms: number) => void } {
  let n = 0;
  const rng = seeded(seed);
  const ctx = {
    now,
    rng,
    uid: () => `id${++n}`,
    fx: emptyEffects(),
    advance(ms: number) {
      ctx.now += ms;
    },
  };
  return ctx;
}
