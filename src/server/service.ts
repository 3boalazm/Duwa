/**
 * Room service: everything the API routes can do.
 *
 * Rules enforced here (and nowhere else):
 *  - a room has two seats; nobody else can ever join it;
 *  - a device is recognised by a secret token, never by the room code alone;
 *  - every change runs in one transaction that locks the room first.
 */
import { leave, next, nextWake, play, propose, respond, tick } from "@/game/engine";
import { type Profile, PROFILE_ERRORS, parseProfile } from "@/game/profile";
import { recordUnlocks } from "@/game/progress";
import type { Ctx, DrawRound, PlayAction, RoomAgg, Seat, SessionResult } from "@/game/types";
import { emptyEffects, emptyStats, GameError, other } from "@/game/types";
import type {
  ActResponse,
  ClientAction,
  DrawResponse,
  EnterResponse,
  HistoryResponse,
  PeekResult,
  StrokeBatch,
  SyncResponse,
} from "./contracts";
import { type Db, getDb, type Queryable } from "./db";
import { ApiFail } from "./http";
import { notify, wait } from "./hub";
import {
  hashSecret,
  newId,
  newRecoveryCode,
  newRoomCode,
  newToken,
  RECOVERY_CODE_LENGTH,
  ROOM_CODE_LENGTH,
  safeEqual,
  secureRandom,
} from "./ids";
import { glanceRoom, loadRoom, loadRoomByCode, savePresence, saveRoom } from "./repo";
import { buildView } from "./view";

/* ------------------------------------------------------------------ */
/*  constants                                                           */
/* ------------------------------------------------------------------ */
/** How long a sync request may wait for news (short while a round is live). */
const HOLD_LIVE_MS = 4_000;
const HOLD_IDLE_MS = 12_000;
/** A player counts as online until their last poll's hold + this margin. */
const PRESENCE_MARGIN_MS = 6_000;
/** Without a shared notifier (several server instances) re-check this often. */
const CROSS_INSTANCE_POLL_MS = 1_000;

const RECOVERY_MAX_FAILS = 8;
const RECOVERY_LOCK_MS = 15 * 60_000;

const DRAW_HOLD_MS = 5_000;
const DRAW_MAX_BATCHES = 2_000;
const DRAW_MAX_OPS = 80;
const DRAW_MAX_POINTS = 600;

export interface Auth {
  pid: string;
  roomId: string;
  seat: Seat;
}

const roomChannel = (roomId: string) => `room:${roomId}`;
const drawChannel = (sid: string, turn: number) => `draw:${sid}:${turn}`;

const UNAUTHORIZED = () => new ApiFail(401, "unauthorized", "الجلسة دي مش معروفة. ادخل الغرفة من جديد.");
const ROOM_GONE = () => new ApiFail(404, "room_gone", "الغرفة دي مبقتش موجودة.");

function makeCtx(now: number): Ctx {
  return { now, rng: secureRandom, uid: newId, fx: emptyEffects() };
}

const isLive = (agg: RoomAgg) =>
  !!agg.session && (agg.session.phase === "countdown" || agg.session.phase === "play" || agg.session.phase === "reveal");

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "23505";
}

/* ------------------------------------------------------------------ */
/*  the one way to change a room                                        */
/* ------------------------------------------------------------------ */
interface Change<T> {
  /** false = nothing to save (the version is not bumped) */
  changed: boolean;
  value: T;
  /** when unchanged, still store this seat's presence */
  presence?: Seat;
  /** the room row itself was deleted */
  deleted?: boolean;
}

async function mutate<T>(
  roomId: string,
  fn: (agg: RoomAgg, ctx: Ctx, q: Queryable) => Change<T> | Promise<Change<T>>,
): Promise<{ agg: RoomAgg; value: T; changed: boolean }> {
  const db = await getDb();
  const now = Date.now();
  const out = await db.tx(async (q) => {
    const agg = await loadRoom(q, roomId, true);
    if (!agg) throw ROOM_GONE();
    const ctx = makeCtx(now);
    const change = await fn(agg, ctx, q);
    if (change.deleted) return { agg, value: change.value, changed: true };
    if (change.changed) {
      await saveRoom(q, agg, ctx.fx, now);
    } else if (change.presence !== undefined) {
      const p = agg.players[change.presence];
      if (p) await savePresence(q, p, now);
    }
    return { agg, value: change.value, changed: change.changed };
  });
  if (out.changed) notify(roomChannel(roomId));
  return out;
}

function requireMe(agg: RoomAgg, auth: Auth) {
  const me = agg.players[auth.seat];
  if (!me || me.id !== auth.pid) throw UNAUTHORIZED();
  return me;
}

/* ------------------------------------------------------------------ */
/*  identity                                                            */
/* ------------------------------------------------------------------ */
const BEARER = /^Bearer ([0-9a-fA-F-]{36})\.([A-Za-z0-9_-]{20,128})$/;

export async function authenticate(header: string | null): Promise<Auth> {
  const m = BEARER.exec(header ?? "");
  if (!m) throw UNAUTHORIZED();
  return authenticatePair(m[1], m[2]);
}

export async function authenticatePair(pid: string, token: string): Promise<Auth> {
  if (!/^[0-9a-fA-F-]{36}$/.test(pid) || typeof token !== "string" || token.length < 20 || token.length > 128) {
    throw UNAUTHORIZED();
  }
  const db = await getDb();
  const rows = await db.query<{ room_id: string; seat: number; token_hash: string }>(
    "select room_id, seat, token_hash from duwa.players where id = $1",
    [pid],
  );
  const row = rows[0];
  if (!row || !safeEqual(hashSecret(token, pid), row.token_hash)) throw UNAUTHORIZED();
  return { pid, roomId: row.room_id, seat: Number(row.seat) as Seat };
}

function cleanCode(input: unknown, length: number): string {
  const code = typeof input === "string" ? input.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  return code.length === length ? code : "";
}

function requireProfile(input: unknown): Profile {
  const parsed = parseProfile(input);
  if (!parsed.ok) throw new ApiFail(400, `profile_${parsed.error}`, PROFILE_ERRORS[parsed.error]);
  return parsed.profile;
}

async function insertPlayer(
  q: Queryable,
  roomId: string,
  seat: Seat,
  profile: Profile,
  now: number,
): Promise<{ pid: string; token: string; recovery: string }> {
  const pid = newId();
  const token = newToken();
  const recovery = newRecoveryCode();
  await q.query(
    `insert into duwa.players
       (id, room_id, seat, name, avatar, color, title, token_hash, recovery_hash, points, stats, seen_until_ms, last_seen_ms, created_ms, gender)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10::text::jsonb, $11, $12, $12, $13)`,
    [
      pid,
      roomId,
      seat,
      profile.name,
      profile.avatar,
      profile.color,
      profile.title,
      hashSecret(token, pid),
      hashSecret(recovery, pid),
      JSON.stringify(emptyStats()),
      now + HOLD_IDLE_MS + PRESENCE_MARGIN_MS,
      now,
      profile.gender,
    ],
  );
  return { pid, token, recovery };
}

/* ------------------------------------------------------------------ */
/*  entering a room                                                     */
/* ------------------------------------------------------------------ */
export async function createRoom(profileInput: unknown): Promise<EnterResponse> {
  const profile = requireProfile(profileInput);
  const db = await getDb();
  const now = Date.now();
  const roomId = newId();

  for (let attempt = 0; ; attempt++) {
    const code = newRoomCode();
    try {
      const creds = await db.tx(async (q) => {
        await q.query(
          `insert into duwa.rooms (id, code, version, shared_points, progress, created_ms, updated_ms)
           values ($1, $2, 1, 0, '{}'::jsonb, $3, $3)`,
          [roomId, code, now],
        );
        const made = await insertPlayer(q, roomId, 0, profile, now);
        const agg = await loadRoom(q, roomId, true);
        if (!agg) throw ROOM_GONE();
        const ctx = makeCtx(now);
        recordUnlocks(agg, ctx); // the starter worlds are open from the first second
        await saveRoom(q, agg, ctx.fx, now);
        return made;
      });
      const agg = await loadRoom(db, roomId);
      if (!agg) throw ROOM_GONE();
      return {
        v: agg.version,
        now: Date.now(),
        view: buildView(agg, 0, Date.now()),
        creds: { pid: creds.pid, token: creds.token, code, recovery: creds.recovery },
      };
    } catch (err) {
      // the invite code already exists: draw another one
      if (isUniqueViolation(err) && attempt < 6) continue;
      throw err;
    }
  }
}

export async function peekRoom(codeInput: unknown): Promise<PeekResult> {
  const code = cleanCode(codeInput, ROOM_CODE_LENGTH);
  if (!code) return { state: "missing" };
  const db = await getDb();
  const agg = await loadRoomByCode(db, code);
  if (!agg) return { state: "missing" };
  const present = agg.players.filter(Boolean);
  if (present.length >= 2) return { state: "full" };
  const host = present[0];
  return {
    state: "open",
    host: host
      ? {
          name: host.name,
          gender: host.gender,
          avatar: host.avatar as Profile["avatar"],
          color: host.color as Profile["color"],
          title: host.title,
        }
      : undefined,
  };
}

export async function joinRoom(codeInput: unknown, profileInput: unknown): Promise<EnterResponse> {
  const code = cleanCode(codeInput, ROOM_CODE_LENGTH);
  if (!code) throw new ApiFail(400, "bad_code", "كود الغرفة لازم يكون 6 حروف وأرقام.");
  const profile = requireProfile(profileInput);
  const db = await getDb();
  const now = Date.now();

  const out = await db.tx(async (q) => {
    const agg = await loadRoomByCode(q, code, true);
    if (!agg) throw new ApiFail(404, "no_room", "مفيش غرفة بالكود ده. راجع الكود وجرّب تاني.");
    // Two seats, no exceptions. The row lock above makes this check race-free.
    const seat: Seat | null = !agg.players[0] ? 0 : !agg.players[1] ? 1 : null;
    if (seat === null) throw new ApiFail(409, "room_full", "الغرفة دي مكتملة بلاعبين.");
    const partner = agg.players[other(seat)];
    if (partner && partner.color === profile.color) {
      throw new ApiFail(409, "color_taken", `اللون ده مع ${partner.name}. اختار لون تاني يميّزك.`);
    }
    const made = await insertPlayer(q, agg.id, seat, profile, now);
    const fresh = await loadRoom(q, agg.id, true);
    if (!fresh) throw ROOM_GONE();
    const ctx = makeCtx(now);
    fresh.progress.flash = { id: ctx.uid(), kind: "joined", by: seat, at: now };
    await saveRoom(q, fresh, ctx.fx, now);
    return { agg: fresh, seat, made };
  });
  notify(roomChannel(out.agg.id));
  return {
    v: out.agg.version,
    now: Date.now(),
    view: buildView(out.agg, out.seat, Date.now()),
    creds: { pid: out.made.pid, token: out.made.token, code, recovery: out.made.recovery },
  };
}

/** Come back to your own seat from a new device, using your recovery code. */
export async function recoverSeat(codeInput: unknown, recoveryInput: unknown): Promise<EnterResponse> {
  const code = cleanCode(codeInput, ROOM_CODE_LENGTH);
  const recovery = cleanCode(recoveryInput, RECOVERY_CODE_LENGTH);
  const WRONG = () => new ApiFail(401, "bad_recovery", "كود الغرفة أو كود الاستعادة مش صح.");
  if (!code || !recovery) throw WRONG();
  const db = await getDb();
  const now = Date.now();

  const out = await db.tx(async (q) => {
    const rooms = await q.query<{ id: string; recovery_fails: number; recovery_locked_ms: number }>(
      "select id, recovery_fails, recovery_locked_ms from duwa.rooms where code = $1 for update",
      [code],
    );
    const room = rooms[0];
    if (!room) return { kind: "wrong" as const };
    if (Number(room.recovery_locked_ms) > now) return { kind: "locked" as const };
    const players = await q.query<{ id: string; seat: number; recovery_hash: string }>(
      "select id, seat, recovery_hash from duwa.players where room_id = $1",
      [room.id],
    );
    const match = players.find((p) => safeEqual(hashSecret(recovery, p.id), p.recovery_hash));
    if (!match) {
      const fails = Number(room.recovery_fails) + 1;
      const lock = fails >= RECOVERY_MAX_FAILS;
      await q.query("update duwa.rooms set recovery_fails = $2, recovery_locked_ms = $3 where id = $1", [
        room.id,
        lock ? 0 : fails,
        lock ? now + RECOVERY_LOCK_MS : 0,
      ]);
      return { kind: "wrong" as const };
    }
    // A fresh device secret: the old device is signed out.
    const token = newToken();
    await q.query("update duwa.players set token_hash = $2 where id = $1", [match.id, hashSecret(token, match.id)]);
    await q.query("update duwa.rooms set recovery_fails = 0, recovery_locked_ms = 0 where id = $1", [room.id]);
    const agg = await loadRoom(q, room.id);
    if (!agg) throw ROOM_GONE();
    return { kind: "ok" as const, agg, seat: Number(match.seat) as Seat, pid: match.id, token };
  });

  if (out.kind === "locked") {
    throw new ApiFail(429, "recovery_locked", "محاولات غلط كتير. الاستعادة متوقفة ربع ساعة لحماية الغرفة.");
  }
  if (out.kind === "wrong") throw WRONG();
  return {
    v: out.agg.version,
    now: Date.now(),
    view: buildView(out.agg, out.seat, Date.now()),
    creds: { pid: out.pid, token: out.token, code, recovery },
  };
}

/* ------------------------------------------------------------------ */
/*  sync (long-poll)                                                    */
/* ------------------------------------------------------------------ */
/**
 * Returns at once when the room is newer than `clientVersion`; otherwise
 * waits for news (or for the next deadline) for a few seconds.
 * Every pass also refreshes this player's presence and lets time move.
 */
export async function sync(auth: Auth, clientVersion: number, signal?: AbortSignal): Promise<SyncResponse> {
  const db = await getDb();
  const started = Date.now();
  const partnerSeat = other(auth.seat);
  let holdMs = HOLD_IDLE_MS;

  for (;;) {
    // A full pass: refresh my presence, let time move, read the room (under the room lock).
    const { agg } = await mutate<null>(auth.roomId, (room, ctx) => {
      const me = requireMe(room, auth);
      const wasOnline = me.seenUntil > ctx.now;
      holdMs = isLive(room) ? HOLD_LIVE_MS : HOLD_IDLE_MS;
      // Online until this request ends (plus a margin for the next one to arrive).
      const until = started + holdMs + PRESENCE_MARGIN_MS;
      const stale = !wasOnline || Math.abs(me.seenUntil - until) > 1_500;
      if (stale) me.seenUntil = until;
      const moved = tick(room, ctx);
      // Coming back online is news for the partner.
      return { changed: moved || !wasOnline, value: null, presence: stale ? auth.seat : undefined };
    });

    let now = Date.now();
    if (agg.version !== clientVersion) {
      return { v: agg.version, now, view: buildView(agg, auth.seat, now) };
    }

    // Nothing new yet: wait for news, for the next deadline, or for the hold to run out.
    const partner = agg.players[partnerSeat];
    for (;;) {
      const left = started + holdMs - now;
      if (left <= 0 || signal?.aborted) {
        return { v: agg.version, now, partnerOnline: !!partner && partner.seenUntil > now };
      }
      const wake = nextWake(agg);
      let ms = wake === null ? left : Math.min(left, Math.max(30, wake - now));
      if (db.kind === "postgres") ms = Math.min(ms, CROSS_INSTANCE_POLL_MS);
      const why = await wait(roomChannel(auth.roomId), ms, signal);
      now = Date.now();
      if (why === "aborted") continue;
      // News from this server, or a deadline: both need the full pass.
      // (The embedded database is a function call away, so it always takes it.)
      if (db.kind !== "postgres" || why === "notified" || (wake !== null && now >= wake)) break;
      // Hosted database: another server instance may have changed the room. Look before locking.
      const glance = await glanceRoom(db, auth.roomId, partnerSeat);
      if (!glance) throw ROOM_GONE();
      if (glance.version !== agg.version) break;
      if (partner && glance.partnerSeenUntil !== null) partner.seenUntil = glance.partnerSeenUntil;
      now = Date.now();
    }
  }
}

/** The page is closing: mark the player away right now instead of after a timeout. */
export async function bye(auth: Auth): Promise<void> {
  await mutate<null>(auth.roomId, (room, ctx) => {
    const me = requireMe(room, auth);
    if (me.seenUntil <= ctx.now) return { changed: false, value: null };
    me.seenUntil = ctx.now;
    tick(room, ctx);
    return { changed: true, value: null };
  });
}

/* ------------------------------------------------------------------ */
/*  actions                                                             */
/* ------------------------------------------------------------------ */
async function freshRoomCode(q: Queryable): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = newRoomCode();
    const taken = await q.query("select 1 as x from duwa.rooms where code = $1", [code]);
    if (!taken.length) return code;
  }
  throw new ApiFail(503, "busy", "حاول تاني بعد لحظة.");
}

export async function act(auth: Auth, action: ClientAction): Promise<ActResponse> {
  try {
    return await applyAction(auth, action);
  } catch (err) {
    // A broken game rule is a normal, explainable refusal — not a server error.
    if (err instanceof GameError) throw new ApiFail(409, err.code, err.message);
    throw err;
  }
}

async function applyAction(auth: Auth, action: ClientAction): Promise<ActResponse> {
  const extra: { recovery?: string; gone?: boolean } = {};

  const { agg } = await mutate<null>(auth.roomId, async (room, ctx, q) => {
    const me = requireMe(room, auth);
    me.seenUntil = Math.max(me.seenUntil, ctx.now + HOLD_LIVE_MS + PRESENCE_MARGIN_MS);

    switch (action.type) {
      case "propose":
        propose(room, auth.seat, String(action.gameId), ctx);
        break;
      case "respond":
        respond(room, auth.seat, action.accept === true, ctx);
        break;
      case "leave":
        leave(room, auth.seat, ctx);
        break;
      case "next":
        next(room, auth.seat, ctx);
        break;
      case "play": {
        const move = action.move;
        if (!move || typeof move !== "object" || typeof (move as { t?: unknown }).t !== "string") {
          throw new ApiFail(400, "bad_action", "الحركة دي مش مفهومة.");
        }
        play(room, auth.seat, move as PlayAction, ctx);
        break;
      }
      case "profile": {
        const profile = requireProfile(action.profile);
        const partner = room.players[other(auth.seat)];
        if (partner && partner.color === profile.color) {
          throw new ApiFail(409, "color_taken", `اللون ده مع ${partner.name}. اختار لون تاني يميّزك.`);
        }
        Object.assign(me, profile);
        break;
      }
      case "rotate_code":
        room.code = await freshRoomCode(q);
        break;
      case "new_recovery": {
        const recovery = newRecoveryCode();
        await q.query("update duwa.players set recovery_hash = $2 where id = $1", [me.id, hashSecret(recovery, me.id)]);
        extra.recovery = recovery;
        break;
      }
      case "delete_me": {
        // Remove the player and everything personal; the invite code is replaced
        // so the old one cannot be used to take the freed seat.
        if (room.session) {
          if (room.session.phase === "done") room.session = null;
          else leave(room, auth.seat, ctx);
        }
        await q.query("delete from duwa.achievements where room_id = $1 and owner = $2", [room.id, auth.seat]);
        await q.query("delete from duwa.players where id = $1", [me.id]);
        room.achievements = room.achievements.filter((a) => a.to !== auth.seat);
        room.players[auth.seat] = null;
        extra.gone = true;
        if (!room.players[other(auth.seat)]) {
          await q.query("delete from duwa.rooms where id = $1", [room.id]); // cascades to everything
          return { changed: true, value: null, deleted: true };
        }
        room.code = await freshRoomCode(q);
        room.progress.flash = { id: ctx.uid(), kind: "left", by: auth.seat, at: ctx.now };
        break;
      }
      default:
        throw new ApiFail(400, "bad_action", "الحركة دي مش مفهومة.");
    }

    tick(room, ctx);
    return { changed: true, value: null };
  });

  const now = Date.now();
  if (extra.gone) {
    // Nothing left to show: the caller clears its device identity.
    return { v: agg.version, now, view: undefined as never, gone: true };
  }
  return { v: agg.version, now, view: buildView(agg, auth.seat, now), ...extra };
}

/* ------------------------------------------------------------------ */
/*  history                                                             */
/* ------------------------------------------------------------------ */
export async function history(auth: Auth): Promise<HistoryResponse> {
  const db = await getDb();
  const rows = await db.query<{ summary: SessionResult | null }>(
    `select summary from duwa.sessions
      where room_id = $1 and status = 'finished' and summary is not null
      order by finished_ms desc
      limit 30`,
    [auth.roomId],
  );
  return {
    items: rows
      .map((r) => r.summary)
      .filter((s): s is SessionResult => !!s)
      .map(withoutLog),
  };
}

/** The history list only needs the headline numbers, not every answer. */
function withoutLog(result: SessionResult): Omit<SessionResult, "log"> {
  const copy: Partial<SessionResult> = { ...result };
  delete copy.log;
  return copy as Omit<SessionResult, "log">;
}

/* ------------------------------------------------------------------ */
/*  drawing strokes («خمن الرسمة»)                                       */
/* ------------------------------------------------------------------ */
function sanitizeOps(input: unknown): unknown[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > DRAW_MAX_OPS) {
    throw new ApiFail(400, "bad_strokes", "بيانات الرسم مش مفهومة.");
  }
  const out: unknown[] = [];
  for (const raw of input) {
    const op = raw as { k?: unknown; id?: unknown; c?: unknown; w?: unknown; p?: unknown };
    if (op?.k === "u" || op?.k === "c") {
      out.push({ k: op.k });
      continue;
    }
    if (op?.k !== "s" || !Array.isArray(op.p) || op.p.length < 2 || op.p.length > DRAW_MAX_POINTS || op.p.length % 2 !== 0) {
      throw new ApiFail(400, "bad_strokes", "بيانات الرسم مش مفهومة.");
    }
    const id = Number(op.id);
    const c = Number(op.c);
    const w = Number(op.w);
    if (!Number.isInteger(id) || id < 0 || id > 1e6 || !Number.isInteger(c) || c < 0 || c > 15 || !(w >= 1 && w <= 60)) {
      throw new ApiFail(400, "bad_strokes", "بيانات الرسم مش مفهومة.");
    }
    const p = op.p.map((n) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0))));
    out.push({ k: "s", id, c, w: Math.round(w), p });
  }
  return out;
}

/** Only the current artist, only while their turn is running. */
export async function pushStrokes(auth: Auth, sid: unknown, turn: unknown, opsInput: unknown): Promise<void> {
  const ops = sanitizeOps(opsInput);
  const db = await getDb();
  const agg = await loadRoom(db, auth.roomId);
  if (!agg) throw ROOM_GONE();
  requireMe(agg, auth);
  const s = agg.session;
  const round = s?.cur as DrawRound | null;
  if (
    !s ||
    s.id !== sid ||
    s.round !== turn ||
    s.phase !== "play" ||
    round?.g !== "draw" ||
    round.step !== "draw" ||
    round.drawer !== auth.seat
  ) {
    throw new ApiFail(409, "not_drawing", "مش دورك في الرسم دلوقتي.");
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const rows = await db.query<{ seq: number }>(
        `insert into duwa.strokes (session_id, turn, seq, data)
         select $1::text, $2::int, coalesce(max(seq), 0) + 1, $3::text::jsonb
           from duwa.strokes where session_id = $1::text and turn = $2::int
         having coalesce(max(seq), 0) < $4::int
         returning seq`,
        [s.id, s.round, JSON.stringify(ops), DRAW_MAX_BATCHES],
      );
      if (!rows.length) throw new ApiFail(409, "canvas_full", "الرسمة وصلت لأقصى حجم.");
      notify(drawChannel(s.id, s.round));
      return;
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 2) continue;
      throw err;
    }
  }
}

async function readStrokes(db: Db, auth: Auth, sid: string, turn: number, after: number): Promise<StrokeBatch[]> {
  const rows = await db.query<{ seq: number; data: unknown[] }>(
    `select st.seq, st.data
       from duwa.strokes st
       join duwa.sessions se on se.id = st.session_id
      where st.session_id = $1 and st.turn = $2 and st.seq > $3 and se.room_id = $4
      order by st.seq`,
    [sid, turn, after, auth.roomId],
  );
  return rows.map((r) => ({ seq: Number(r.seq), ops: r.data }));
}

export async function pullStrokes(
  auth: Auth,
  sid: string,
  turn: number,
  after: number,
  signal?: AbortSignal,
  hold = true,
): Promise<DrawResponse> {
  const db = await getDb();
  const started = Date.now();
  for (;;) {
    const batches = await readStrokes(db, auth, sid, turn, after);
    const left = started + DRAW_HOLD_MS - Date.now();
    if (batches.length || !hold || left <= 0 || signal?.aborted) return { batches };
    await wait(drawChannel(sid, turn), db.kind === "postgres" ? Math.min(left, 350) : left, signal);
  }
}
