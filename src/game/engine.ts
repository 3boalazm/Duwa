/**
 * Session engine — the single authority on what happens in a round.
 *
 * It is a pure state machine over the room aggregate: the server loads the
 * room inside a database transaction, calls one of these functions, and
 * stores the result. Phones never decide scores, timing or unlocks.
 *
 *   invite → countdown → play ⇄ reveal → … → done
 *
 * Time only moves through `tick()`, which the server calls on every request
 * for the room. While a player is disconnected the clock is frozen, so a
 * dropped connection never costs anyone a round.
 */
import { GAMES, isPlayable, type PlayableGameId } from "./catalog";
import { MODULES } from "./games";
import type { GameModule, Picker } from "./games/module";
import { gameUnlocked, settle } from "./progress";
import type { Ctx, Flash, PlayAction, RoomAgg, RoundLog, Seat, SessionResult, SessionState } from "./types";
import { GameError, other, SEATS } from "./types";
import type { RoundView } from "./views";

export const COUNTDOWN_MS = 3_500;
/** Minimum time a player gets after a paused round resumes. */
export const RESUME_GRACE_MS = 8_000;
const SEEN_CAP = 600;

/* ------------------------------------------------------------------ */
/*  helpers                                                             */
/* ------------------------------------------------------------------ */
const isOnline = (agg: RoomAgg, seat: Seat, now: number) => (agg.players[seat]?.seenUntil ?? 0) > now;

function setClock(s: SessionState, now: number, ms: number) {
  s.endsAt = now + ms;
  s.phaseMs = ms;
  s.pause = null;
}

function flash(agg: RoomAgg, ctx: Ctx, kind: Flash["kind"], by: Seat) {
  agg.progress.flash = { id: ctx.uid(), kind, by, at: ctx.now };
}

function makePicker(seen: string[], rng: () => number): Picker {
  return (pool, n = 1) => {
    let fresh = pool.filter((item) => !seen.includes(item.id));
    if (fresh.length < n) {
      // Everything was used: forget this pool and start over.
      const ids = new Set(pool.map((item) => item.id));
      for (let i = seen.length - 1; i >= 0; i--) if (ids.has(seen[i])) seen.splice(i, 1);
      fresh = [...pool];
    }
    const out = [];
    const bag = [...fresh];
    for (let i = 0; i < n && bag.length; i++) {
      const [item] = bag.splice(Math.floor(rng() * bag.length), 1);
      out.push(item);
      seen.push(item.id);
    }
    if (seen.length > SEEN_CAP) seen.splice(0, seen.length - SEEN_CAP);
    return out;
  };
}

function names(agg: RoomAgg): [string, string] {
  return [agg.players[0]?.name ?? "", agg.players[1]?.name ?? ""];
}

function requireSession(agg: RoomAgg): SessionState {
  if (!agg.session) throw new GameError("no_session", "مفيش جولة شغالة دلوقتي.");
  return agg.session;
}

/** Per-seat record of what was submitted in a round (audit table). */
function answerOf(log: RoundLog, seat: Seat): unknown {
  switch (log.g) {
    case "guess":
      return { mine: log.mine[seat], guess: log.guess[seat], hit: log.hit[seat] };
    case "noyes":
      return { text: log.ans[seat], verdict: log.verdict[seat] };
    case "word":
      return { text: log.ans[seat], match: log.match };
    case "envelope":
      return log.ans[seat];
    case "minute":
      return { list: log.lists[seat], count: log.count[seat] };
    case "draw":
      return { drawer: log.drawer === seat, solved: log.solved, secs: log.secs, pts: log.pts[seat] };
  }
}

/* ------------------------------------------------------------------ */
/*  transitions                                                         */
/* ------------------------------------------------------------------ */
function startRound(agg: RoomAgg, s: SessionState, ctx: Ctx) {
  const mod = MODULES[s.gameId];
  const seen = (agg.progress.seen[s.gameId] ??= []);
  const { round, ms } = mod.begin(s, ctx, makePicker(seen, ctx.rng));
  s.cur = round;
  s.phase = "play";
  s.ready = [false, false];
  if (s.startedAt === null) s.startedAt = ctx.now;
  setClock(s, ctx.now, ms);
}

function resolveRound(s: SessionState, ctx: Ctx) {
  const mod = MODULES[s.gameId];
  const { log, revealMs, over } = mod.resolve(s, ctx);
  s.log.push(log);
  if (over) s.data.over = true;
  for (const seat of SEATS) {
    ctx.fx.answers.push({ sessionId: s.id, round: s.round, seat, kind: "answer", payload: answerOf(log, seat) });
  }
  s.phase = "reveal";
  s.ready = [false, false];
  setClock(s, ctx.now, revealMs);
}

function finish(agg: RoomAgg, s: SessionState, ctx: Ctx) {
  const outcome = MODULES[s.gameId].outcome(s, names(agg));
  s.result = settle(agg, s, outcome, ctx);
  s.phase = "done";
  s.cur = null;
  s.endsAt = null;
  s.phaseMs = null;
  s.pause = null;
  ctx.fx.closed.push({ id: s.id, status: "finished", summary: s.result });
}

function advance(agg: RoomAgg, s: SessionState, ctx: Ctx) {
  if (s.data.over === true || s.round + 1 >= s.totalRounds) {
    finish(agg, s, ctx);
  } else {
    s.round += 1;
    startRound(agg, s, ctx);
  }
}

function abort(agg: RoomAgg, s: SessionState, ctx: Ctx) {
  ctx.fx.closed.push({ id: s.id, status: "aborted", summary: null });
  agg.session = null;
}

/* ------------------------------------------------------------------ */
/*  public API                                                          */
/* ------------------------------------------------------------------ */
/** A player invites the other to a game. */
export function propose(agg: RoomAgg, seat: Seat, gameId: string, ctx: Ctx): void {
  if (!agg.players[0] || !agg.players[1]) {
    throw new GameError("alone", "لازم اللاعب التاني يدخل الغرفة الأول.");
  }
  if (!isPlayable(gameId)) throw new GameError("soon", "اللعبة دي لسه جاية في تحديث قريب.");
  if (!gameUnlocked(agg, gameId)) {
    throw new GameError("locked", "اللعبة دي لسه مقفولة. جمّعوا نقاط أكتر في الرصيد المشترك.");
  }
  if (agg.session && agg.session.phase !== "done") {
    throw new GameError("busy", "فيه جولة شغالة بالفعل.");
  }
  const mod = MODULES[gameId as PlayableGameId];
  const s: SessionState = {
    id: ctx.uid(),
    gameId: gameId as PlayableGameId,
    phase: "invite",
    host: seat,
    createdAt: ctx.now,
    startedAt: null,
    endsAt: null,
    phaseMs: null,
    pause: null,
    round: 0,
    totalRounds: mod.rounds,
    cur: null,
    log: [],
    score: [0, 0],
    team: 0,
    ready: [false, false],
    data: {},
    result: null,
  };
  mod.init(s);
  agg.session = s;
}

/** The invited player accepts or declines. */
export function respond(agg: RoomAgg, seat: Seat, accept: boolean, ctx: Ctx): void {
  const s = requireSession(agg);
  if (s.phase !== "invite" || seat === s.host) throw new GameError("bad_action", "الدعوة دي مش متاحة دلوقتي.");
  if (accept) {
    s.phase = "countdown";
    setClock(s, ctx.now, COUNTDOWN_MS);
  } else {
    flash(agg, ctx, "declined", seat);
    abort(agg, s, ctx);
  }
}

/** Cancel an invite, or leave a round in progress. No points are awarded. */
export function leave(agg: RoomAgg, seat: Seat, ctx: Ctx): void {
  const s = requireSession(agg);
  if (s.phase === "done") {
    // Results are already saved; just clear the table.
    agg.session = null;
    return;
  }
  if (s.phase === "invite") flash(agg, ctx, seat === s.host ? "cancelled" : "declined", seat);
  else flash(agg, ctx, "quit", seat);
  abort(agg, s, ctx);
}

/** A game move during the play phase. */
export function play(agg: RoomAgg, seat: Seat, action: PlayAction, ctx: Ctx): void {
  const s = requireSession(agg);
  if (s.phase !== "play" || !s.cur) throw new GameError("too_late", "الوقت خلص على الحركة دي.");
  const result = MODULES[s.gameId].action(s, seat, action, ctx);
  if (result === "resolve") resolveRound(s, ctx);
  else if (result !== "ok") setClock(s, ctx.now, result.ms);
}

/** "Next" during the reveal; the round moves on when both are ready. */
export function next(agg: RoomAgg, seat: Seat, ctx: Ctx): void {
  const s = requireSession(agg);
  if (s.phase !== "reveal") return;
  s.ready[seat] = true;
  if (s.ready[other(seat)]) advance(agg, s, ctx);
}

/**
 * Move time forward. Returns true when the room changed.
 * Rule: a timed phase can only run out while both players are connected.
 */
export function tick(agg: RoomAgg, ctx: Ctx): boolean {
  const s = agg.session;
  if (!s || s.phase === "invite" || s.phase === "done") return false;

  const offline = SEATS.filter((seat) => !isOnline(agg, seat, ctx.now));

  if (s.pause) {
    if (offline.length === 0) {
      const ms =
        s.phase === "countdown"
          ? COUNTDOWN_MS
          : s.phase === "play"
            ? Math.max(s.pause.remainingMs, RESUME_GRACE_MS)
            : Math.max(s.pause.remainingMs, 4_000);
      s.endsAt = ctx.now + ms;
      s.phaseMs = Math.max(s.phaseMs ?? ms, ms);
      s.pause = null;
      return true;
    }
    if (!offline.includes(s.pause.seat)) {
      s.pause.seat = offline[0];
      return true;
    }
    return false;
  }

  if (offline.length > 0) {
    s.pause = { seat: offline[0], since: ctx.now, remainingMs: Math.max(0, (s.endsAt ?? ctx.now) - ctx.now) };
    s.endsAt = null;
    return true;
  }

  let changed = false;
  for (let guard = 0; guard < 6; guard++) {
    const mod: GameModule = MODULES[s.gameId];
    if (s.phase === "play" && mod.tick?.(s, ctx)) changed = true;
    if (s.endsAt === null || ctx.now < s.endsAt) break;
    changed = true;
    if (s.phase === "countdown") {
      startRound(agg, s, ctx);
    } else if (s.phase === "play") {
      const r = mod.timeout(s, ctx);
      if (r === "resolve") resolveRound(s, ctx);
      else setClock(s, ctx.now, r.ms);
    } else if (s.phase === "reveal") {
      advance(agg, s, ctx);
    }
    if ((s.phase as string) === "done") break;
  }
  return changed;
}

/** When the server should next look at this room without being asked. */
export function nextWake(agg: RoomAgg): number | null {
  const s = agg.session;
  if (!s || s.phase === "invite" || s.phase === "done" || s.pause) return null;
  const times: number[] = [];
  if (s.endsAt !== null) times.push(s.endsAt);
  if (s.phase === "play") {
    const extra = MODULES[s.gameId].wake?.(s);
    if (extra) times.push(extra);
  }
  // A player dropping out must freeze the clock promptly.
  for (const seat of SEATS) {
    const until = agg.players[seat]?.seenUntil;
    if (until) times.push(until + 30);
  }
  return times.length ? Math.min(...times) : null;
}

/* ------------------------------------------------------------------ */
/*  per-player view                                                     */
/* ------------------------------------------------------------------ */
export interface SessionView {
  id: string;
  gameId: PlayableGameId;
  gameName: string;
  phase: SessionState["phase"];
  host: Seat;
  round: number;
  totalRounds: number;
  endsAt: number | null;
  phaseMs: number | null;
  pause: { seat: Seat; since: number } | null;
  score: [number, number];
  team: number;
  ready: [boolean, boolean];
  /** the round in progress, redacted for this player */
  cur: RoundView | null;
  /** rounds already revealed */
  log: RoundLog[];
  result: SessionResult | null;
}

export function sessionView(s: SessionState, seat: Seat): SessionView {
  return {
    id: s.id,
    gameId: s.gameId,
    gameName: GAMES[s.gameId].name,
    phase: s.phase,
    host: s.host,
    round: s.round,
    totalRounds: s.totalRounds,
    endsAt: s.endsAt,
    phaseMs: s.phaseMs,
    pause: s.pause ? { seat: s.pause.seat, since: s.pause.since } : null,
    score: [s.score[0], s.score[1]],
    team: s.team,
    ready: [s.ready[0], s.ready[1]],
    cur: s.cur && (s.phase === "play" || s.phase === "reveal") ? MODULES[s.gameId].view(s, seat) : null,
    log: s.log,
    result: s.result,
  };
}
