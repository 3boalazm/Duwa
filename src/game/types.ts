/**
 * Core game types. Everything here is plain JSON so a session can be stored
 * in the database between requests and restored after a disconnect.
 */
import type { GameId, PlayableGameId, WorldId } from "./catalog";

export type Seat = 0 | 1;
/** `2` means "the pair" — shared balance, duo achievements. */
export type Owner = Seat | 2;

export const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);
export const SEATS: Seat[] = [0, 1];

export type Phase = "invite" | "countdown" | "play" | "reveal" | "done";

/* ------------------------------------------------------------------ */
/*  Rounds (server-side truth)                                          */
/* ------------------------------------------------------------------ */
export interface GuessAnswer {
  mine: number;
  guess: number;
}
export interface GuessRound {
  g: "guess";
  qid: string;
  text: string;
  options: string[];
  ans: [GuessAnswer | null, GuessAnswer | null];
}

export type NoYesVerdict = "ok" | "forbidden" | "empty" | "repeat";
export interface NoYesRound {
  g: "noyes";
  qid: string;
  text: string;
  ans: [string | null, string | null];
}

export interface WordRound {
  g: "word";
  qid: string;
  text: string;
  ans: [string | null, string | null];
}

export type EnvelopeAnswer = { text: string } | { who: Seat } | { skip: true };
export interface EnvelopeRound {
  g: "envelope";
  cid: string;
  kind: "open" | "who";
  text: string;
  step: "sealed" | "answer";
  opened: [boolean, boolean];
  ans: [EnvelopeAnswer | null, EnvelopeAnswer | null];
}

/** ok = in the dictionary · ask = the partner judges it · no = rejected by the partner */
export type EntryStatus = "ok" | "ask" | "no";
export interface MinuteEntry {
  text: string;
  key: string;
  st: EntryStatus;
}
export interface MinuteRound {
  g: "minute";
  cid: string;
  title: string;
  target: number;
  step: "write" | "review";
  entries: [MinuteEntry[], MinuteEntry[]];
  reviewed: [boolean, boolean];
}

export interface DrawGuess {
  text: string;
  close: boolean;
  at: number;
}
export interface DrawRound {
  g: "draw";
  drawer: Seat;
  step: "choose" | "draw";
  choices: { w: string; a?: string[] }[];
  word: { w: string; a?: string[] } | null;
  guesses: DrawGuess[];
  drawAt: number | null;
  solvedAt: number | null;
  hint: boolean;
}

export type Round = GuessRound | NoYesRound | WordRound | EnvelopeRound | MinuteRound | DrawRound;

/* ------------------------------------------------------------------ */
/*  Round logs (public once the round is revealed)                      */
/* ------------------------------------------------------------------ */
export interface GuessLog {
  g: "guess";
  text: string;
  options: string[];
  mine: [number, number];
  guess: [number, number];
  hit: [boolean, boolean];
}
export interface NoYesLog {
  g: "noyes";
  text: string;
  ans: [string, string];
  verdict: [NoYesVerdict, NoYesVerdict];
  bad: [string | null, string | null];
  lives: [number, number];
}
export interface WordLog {
  g: "word";
  text: string;
  ans: [string, string];
  match: "exact" | "close" | "none";
}
export interface EnvelopeLog {
  g: "envelope";
  kind: "open" | "who";
  text: string;
  ans: [EnvelopeAnswer, EnvelopeAnswer];
  agree: boolean | null;
}
export interface MinuteLog {
  g: "minute";
  title: string;
  target: number;
  lists: [{ text: string; st: EntryStatus }[], { text: string; st: EntryStatus }[]];
  count: [number, number];
}
export interface DrawLog {
  g: "draw";
  turn: number;
  drawer: Seat;
  word: string;
  solved: boolean;
  secs: number | null;
  pts: [number, number];
}
export type RoundLog = GuessLog | NoYesLog | WordLog | EnvelopeLog | MinuteLog | DrawLog;

/* ------------------------------------------------------------------ */
/*  Session                                                             */
/* ------------------------------------------------------------------ */
export interface SessionState {
  id: string;
  gameId: PlayableGameId;
  phase: Phase;
  host: Seat;
  createdAt: number;
  startedAt: number | null;
  /** server deadline (epoch ms) of the current timed phase/step */
  endsAt: number | null;
  /** full length of the current timed phase/step, for the timer ring */
  phaseMs: number | null;
  /** set while a player is disconnected: the clock is frozen */
  pause: { seat: Seat; since: number; remainingMs: number } | null;
  round: number;
  totalRounds: number;
  cur: Round | null;
  log: RoundLog[];
  /** per-player score inside this session */
  score: [number, number];
  /** co-op score inside this session */
  team: number;
  /** "next" taps during reveal */
  ready: [boolean, boolean];
  /** game-specific counters (lives, streaks…) */
  data: Record<string, unknown>;
  result: SessionResult | null;
}

export type AwardReason = "complete" | "win" | "tie" | "hard" | "team" | "achievement" | "journey";

export interface Award {
  to: Owner;
  reason: AwardReason;
  points: number;
  label: string;
}

export interface SessionResult {
  sessionId: string;
  gameId: PlayableGameId;
  finishedAt: number;
  coop: boolean;
  /** null = tie, or a co-op game */
  winner: Seat | null;
  score: [number, number];
  team: number;
  /** co-op headline, e.g. "توافق 4 من 6" */
  headline: string;
  awards: Award[];
  /** personal points gained by each player */
  earned: [number, number];
  sharedBefore: number;
  sharedAfter: number;
  unlocked: WorldId[];
  achievements: { key: string; to: Owner }[];
  journey: string[];
  log: RoundLog[];
}

/** What a game reports when its last round is over. */
export interface Outcome {
  coop: boolean;
  winner: Seat | null;
  /** who beat the game's hard challenge */
  hard: [boolean, boolean];
  /** co-op mission reached */
  team: boolean;
  headline: string;
  /** facts used by achievements and «رحلتنا» */
  facts: Record<string, number | boolean>;
}

/* ------------------------------------------------------------------ */
/*  Player actions during play                                          */
/* ------------------------------------------------------------------ */
export type PlayAction =
  | { t: "answer"; mine?: unknown; guess?: unknown; text?: unknown; who?: unknown }
  | { t: "open" }
  | { t: "entry"; text?: unknown }
  | { t: "review"; reject?: unknown }
  | { t: "choose"; i?: unknown }
  | { t: "guess"; text?: unknown };

/* ------------------------------------------------------------------ */
/*  Room aggregate (what the engine reads and mutates)                  */
/* ------------------------------------------------------------------ */
export interface PlayerStats {
  sessions: number;
  wins: number;
  losses: number;
  ties: number;
  streak: number;
  bestStreak: number;
  games: Partial<Record<GameId, { plays: number; wins: number }>>;
}

export const emptyStats = (): PlayerStats => ({
  sessions: 0,
  wins: 0,
  losses: 0,
  ties: 0,
  streak: 0,
  bestStreak: 0,
  games: {},
});

export interface PlayerState {
  id: string;
  seat: Seat;
  name: string;
  gender: "m" | "f";
  avatar: string;
  color: string;
  title: string;
  points: number;
  stats: PlayerStats;
  /** presence: considered online until this time (epoch ms) */
  seenUntil: number;
}

export interface LastRound {
  sessionId: string;
  gameId: PlayableGameId;
  finishedAt: number;
  coop: boolean;
  winner: Seat | null;
  score: [number, number];
  headline: string;
}

export interface Flash {
  id: string;
  kind: "declined" | "cancelled" | "quit" | "joined" | "left";
  by: Seat;
  at: number;
}

export interface RoomProgress {
  /** content ids already used, per game, so questions do not repeat */
  seen: Partial<Record<PlayableGameId, string[]>>;
  /** finished sessions per game */
  plays: Partial<Record<GameId, number>>;
  sessions: number;
  /** number of completed «رحلتنا» stages */
  journey: number;
  last: LastRound | null;
  flash: Flash | null;
}

export const emptyProgress = (): RoomProgress => ({
  seen: {},
  plays: {},
  sessions: 0,
  journey: 0,
  last: null,
  flash: null,
});

export interface AchievementRecord {
  key: string;
  to: Owner;
  at: number;
}

export interface RoomAgg {
  id: string;
  code: string;
  version: number;
  shared: number;
  progress: RoomProgress;
  players: [PlayerState | null, PlayerState | null];
  session: SessionState | null;
  achievements: AchievementRecord[];
  /** recorded world unlocks */
  unlocks: { world: WorldId; at: number }[];
}

/** Side effects the storage layer must persist atomically with the room. */
export interface Effects {
  scores: { to: Owner; reason: AwardReason; points: number; key: string; sessionId: string | null }[];
  achievements: AchievementRecord[];
  unlocks: { world: WorldId; at: number }[];
  answers: { sessionId: string; round: number; seat: Seat; kind: string; payload: unknown }[];
  /** a session that ended in this mutation */
  closed: { id: string; status: "finished" | "aborted"; summary: SessionResult | null }[];
}

export const emptyEffects = (): Effects => ({ scores: [], achievements: [], unlocks: [], answers: [], closed: [] });

export interface Ctx {
  now: number;
  /** uniform random in [0, 1) */
  rng: () => number;
  uid: () => string;
  fx: Effects;
}

/** A rule violation the player should see (message is user-facing Arabic). */
export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "GameError";
  }
}
