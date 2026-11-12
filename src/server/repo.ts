/**
 * Loading and saving the room aggregate.
 * Every change to a room happens inside one transaction that first locks the
 * room row and only then reads it, so two phones can never interleave
 * half-finished updates or work from each other's stale copy.
 */
import { nextWake } from "@/game/engine";
import type { Effects, PlayerState, RoomAgg, RoomProgress, Seat, SessionState } from "@/game/types";
import { emptyProgress, emptyStats } from "@/game/types";
import type { Queryable } from "./db";

interface RoomRow {
  id: string;
  code: string;
  version: number;
  shared_points: number;
  progress: Partial<RoomProgress> | null;
  players: Array<Omit<PlayerState, "stats"> & { stats: Partial<PlayerState["stats"]> | null }>;
  session: SessionState | null;
  achievements: RoomAgg["achievements"];
  unlocks: RoomAgg["unlocks"];
}

const ROOM_SELECT = /* sql */ `
select
  r.id,
  r.code,
  r.version,
  r.shared_points,
  r.progress,
  (select coalesce(json_agg(json_build_object(
      'id', p.id, 'seat', p.seat, 'name', p.name, 'gender', p.gender, 'avatar', p.avatar, 'color', p.color,
      'title', p.title, 'points', p.points, 'stats', p.stats, 'seenUntil', p.seen_until_ms
    ) order by p.seat), '[]'::json)
   from duwa.players p where p.room_id = r.id) as players,
  (select s.state from duwa.sessions s where s.id = r.active_session_id) as session,
  (select coalesce(json_agg(json_build_object('key', a.key, 'to', a.owner, 'at', a.unlocked_ms)), '[]'::json)
   from duwa.achievements a where a.room_id = r.id) as achievements,
  (select coalesce(json_agg(json_build_object('world', u.world_id, 'at', u.unlocked_ms)), '[]'::json)
   from duwa.unlocks u where u.room_id = r.id) as unlocks
from duwa.rooms r
`;

function toAgg(row: RoomRow): RoomAgg {
  const players: RoomAgg["players"] = [null, null];
  for (const p of row.players ?? []) {
    const seat = Number(p.seat) as Seat;
    players[seat] = {
      id: p.id,
      seat,
      name: p.name,
      gender: p.gender === "f" ? "f" : "m",
      avatar: p.avatar,
      color: p.color,
      title: p.title,
      points: Number(p.points),
      stats: { ...emptyStats(), ...(p.stats ?? {}) },
      seenUntil: Number(p.seenUntil ?? 0),
    };
  }
  return {
    id: row.id,
    code: row.code,
    version: Number(row.version),
    shared: Number(row.shared_points),
    progress: { ...emptyProgress(), ...(row.progress ?? {}) },
    players,
    session: row.session ?? null,
    achievements: (row.achievements ?? []).map((a) => ({ key: a.key, to: Number(a.to) as 0 | 1 | 2, at: Number(a.at) })),
    unlocks: (row.unlocks ?? []).map((u) => ({ world: u.world, at: Number(u.at) })),
  };
}

/**
 * Locks the room row until the transaction ends and returns the room id.
 *
 * The lock is a statement of its own on purpose. A statement that has to wait
 * for a row lock re-reads only that row once it gets it; whatever else it
 * selects (the running round, the players) is still read as of the moment the
 * statement started — that is, WITHOUT the change the other phone has just
 * committed. Locking first and reading afterwards gives the read a snapshot
 * taken after the other phone was done.
 */
async function lockRoom(q: Queryable, column: "id" | "code", value: string): Promise<string | null> {
  const rows = await q.query<{ id: string }>(`select id from duwa.rooms where ${column} = $1 for update`, [value]);
  return rows[0]?.id ?? null;
}

/** `lock` must only be used inside a transaction: it serialises every change to the room. */
export async function loadRoom(q: Queryable, roomId: string, lock = false): Promise<RoomAgg | null> {
  if (lock && !(await lockRoom(q, "id", roomId))) return null;
  const rows = await q.query<RoomRow>(`${ROOM_SELECT} where r.id = $1`, [roomId]);
  return rows[0] ? toAgg(rows[0]) : null;
}

export async function loadRoomByCode(q: Queryable, code: string, lock = false): Promise<RoomAgg | null> {
  if (lock) {
    const id = await lockRoom(q, "code", code);
    return id ? loadRoom(q, id) : null;
  }
  const rows = await q.query<RoomRow>(`${ROOM_SELECT} where r.code = $1`, [code]);
  return rows[0] ? toAgg(rows[0]) : null;
}

/** The little a waiting request needs to know whether anything happened (no lock, one index lookup). */
export async function glanceRoom(
  q: Queryable,
  roomId: string,
  partnerSeat: Seat,
): Promise<{ version: number; partnerSeenUntil: number | null } | null> {
  const rows = await q.query<{ version: number; partner_until: number | null }>(
    `select r.version,
            (select p.seen_until_ms from duwa.players p where p.room_id = r.id and p.seat = $2) as partner_until
       from duwa.rooms r
      where r.id = $1`,
    [roomId, partnerSeat],
  );
  const row = rows[0];
  if (!row) return null;
  return { version: Number(row.version), partnerSeenUntil: row.partner_until === null ? null : Number(row.partner_until) };
}

/** Presence is written on every poll, so it has its own tiny statement. */
export async function savePresence(q: Queryable, player: PlayerState, now: number): Promise<void> {
  await q.query("update duwa.players set seen_until_ms = $2, last_seen_ms = $3 where id = $1", [
    player.id,
    player.seenUntil,
    now,
  ]);
}

/** Persist the aggregate and its side effects; bumps and returns the room version. */
export async function saveRoom(q: Queryable, agg: RoomAgg, fx: Effects, now: number): Promise<number> {
  const rows = await q.query<{ version: number }>(
    `update duwa.rooms
        set version = version + 1, code = $2, shared_points = $3, progress = $4::text::jsonb,
            active_session_id = $5, wake_ms = $6, updated_ms = $7
      where id = $1
      returning version`,
    [agg.id, agg.code, agg.shared, JSON.stringify(agg.progress), agg.session?.id ?? null, nextWake(agg), now],
  );
  agg.version = Number(rows[0].version);

  for (const p of agg.players) {
    if (!p) continue;
    await q.query(
      `update duwa.players
          set name = $2, avatar = $3, color = $4, title = $5, points = $6, stats = $7::text::jsonb,
              seen_until_ms = $8, gender = $9
        where id = $1`,
      [p.id, p.name, p.avatar, p.color, p.title, p.points, JSON.stringify(p.stats), p.seenUntil, p.gender],
    );
  }

  const s = agg.session;
  if (s) {
    await q.query(
      `insert into duwa.sessions (id, room_id, game_id, status, state, summary, started_ms, finished_ms)
       values ($1, $2, $3, $4, $5::text::jsonb, $6::text::jsonb, $7, $8)
       on conflict (id) do update
         set status = excluded.status, state = excluded.state, summary = excluded.summary, finished_ms = excluded.finished_ms`,
      [
        s.id,
        agg.id,
        s.gameId,
        s.phase === "done" ? "finished" : "active",
        JSON.stringify(s),
        s.result ? JSON.stringify(s.result) : null,
        s.createdAt,
        s.result?.finishedAt ?? null,
      ],
    );
  }

  for (const c of fx.closed) {
    if (c.status === "aborted") {
      await q.query("update duwa.sessions set status = 'aborted', finished_ms = $2 where id = $1", [c.id, now]);
    }
  }

  for (const a of fx.answers) {
    await q.query(
      `insert into duwa.answers (session_id, round, seat, kind, payload, created_ms)
       values ($1, $2, $3, $4, $5::text::jsonb, $6)
       on conflict do nothing`,
      [a.sessionId, a.round, a.seat, a.kind, JSON.stringify(a.payload ?? null), now],
    );
  }

  // No "on conflict" here on purpose: awarding the same thing twice must fail loudly
  // and roll the whole change back.
  for (const sc of fx.scores) {
    await q.query(
      `insert into duwa.scores (room_id, key, session_id, owner, reason, points, created_ms)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [agg.id, sc.key, sc.sessionId, sc.to, sc.reason, sc.points, now],
    );
  }

  for (const a of fx.achievements) {
    await q.query(
      "insert into duwa.achievements (room_id, owner, key, unlocked_ms) values ($1, $2, $3, $4)",
      [agg.id, a.to, a.key, a.at],
    );
  }

  for (const u of fx.unlocks) {
    await q.query(
      "insert into duwa.unlocks (room_id, world_id, unlocked_ms) values ($1, $2, $3) on conflict do nothing",
      [agg.id, u.world, u.at],
    );
  }

  return agg.version;
}
