/**
 * What each player is allowed to see of the round in progress.
 * Built on the server per seat — secrets (the partner's answer, the word
 * being drawn…) never leave the server before the reveal.
 */
import type { DrawGuess, EntryStatus, EnvelopeAnswer, GuessAnswer, Seat } from "./types";

export interface GuessView {
  g: "guess";
  text: string;
  options: string[];
  mine: GuessAnswer | null;
  partnerDone: boolean;
}

export interface NoYesView {
  g: "noyes";
  text: string;
  mine: string | null;
  partnerDone: boolean;
  lives: [number, number];
}

export interface WordView {
  g: "word";
  text: string;
  mine: string | null;
  partnerDone: boolean;
}

export interface EnvelopeView {
  g: "envelope";
  step: "sealed" | "answer";
  opened: [boolean, boolean];
  /** hidden while the envelope is sealed */
  kind: "open" | "who" | null;
  text: string | null;
  mine: EnvelopeAnswer | null;
  partnerDone: boolean;
}

export interface MinuteView {
  g: "minute";
  title: string;
  target: number;
  /** the server knows the valid answers and checks them instantly */
  dict: boolean;
  step: "write" | "review";
  mine: { text: string; st: EntryStatus }[];
  /** partner answers already confirmed (dictionary challenges) or simply written (open ones) */
  partnerCount: number;
  /** partner answers still waiting for a verdict (dictionary challenges only) */
  partnerPending: number;
  /** partner answers waiting for my verdict (review step only) */
  toJudge: { i: number; text: string }[];
  reviewed: [boolean, boolean];
}

export interface DrawView {
  g: "draw";
  drawer: Seat;
  step: "choose" | "draw";
  /** drawer only */
  choices: string[] | null;
  /** drawer only (everyone sees it in the round log after the reveal) */
  word: string | null;
  /** letter count per word, e.g. [5, 3] for a two-word answer */
  shape: number[];
  /** first letter, revealed to the guesser late in the turn */
  hint: string | null;
  guesses: DrawGuess[];
  drawAt: number | null;
}

export type RoundView = GuessView | NoYesView | WordView | EnvelopeView | MinuteView | DrawView;
