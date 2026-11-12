import type { PlayableGameId } from "../catalog";
import type { Ctx, Outcome, PlayAction, Round, RoundLog, Seat, SessionState } from "../types";
import { GameError } from "../types";
import type { RoundView } from "../views";

/** Picks `n` items that this room has not seen yet (and marks them as seen). */
export type Picker = <T extends { id: string }>(pool: readonly T[], n?: number) => T[];

/** A step inside the round changed and has its own clock. */
export interface StepChange {
  ms: number;
}

export type ActionResult = "ok" | "resolve" | StepChange;

export interface GameModule {
  id: PlayableGameId;
  rounds: number;
  /** Prepare session-level counters. */
  init(s: SessionState): void;
  /** Build round number `s.round` and say how long players get. */
  begin(s: SessionState, ctx: Ctx, pick: Picker): { round: Round; ms: number };
  /** Apply a player action; throws GameError for anything not allowed. */
  action(s: SessionState, seat: Seat, a: PlayAction, ctx: Ctx): ActionResult;
  /** The clock of the current step ran out. */
  timeout(s: SessionState, ctx: Ctx): "resolve" | StepChange;
  /** Optional mid-step change driven by time (returns true if state changed). */
  tick?(s: SessionState, ctx: Ctx): boolean;
  /** Optional extra wake-up time for `tick`. */
  wake?(s: SessionState): number | null;
  /** Judge the round, update scores, and return the public log entry. */
  resolve(s: SessionState, ctx: Ctx): { log: RoundLog; revealMs: number; over?: boolean };
  /** Per-seat redacted view of the round in progress. */
  view(s: SessionState, seat: Seat): RoundView;
  outcome(s: SessionState, names: [string, string]): Outcome;
}

export const BAD_ACTION = () => new GameError("bad_action", "الحركة دي مش متاحة دلوقتي.");
export const ALREADY = () => new GameError("already", "إجابتك اتسجلت خلاص.");

export function asIndex(value: unknown, size: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= size) throw BAD_ACTION();
  return value;
}

export function winnerOf(score: [number, number]): Seat | null {
  if (score[0] === score[1]) return null;
  return score[0] > score[1] ? 0 : 1;
}
