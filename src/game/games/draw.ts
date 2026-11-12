import { DRAW_WORDS } from "../content/draw";
import { cleanText } from "../profile";
import { closeness, letterCount, wordKey } from "../text";
import type { DrawLog, DrawRound, SessionState } from "../types";
import { other } from "../types";
import { asIndex, BAD_ACTION, type GameModule, winnerOf } from "./module";

const GUESS_MAX = 24;
const MAX_GUESSES = 40;
const CHOOSE_MS = 15_000;
export const DRAW_MS = 75_000;
/** the guesser gets the first letter after this long */
const HINT_AFTER_MS = 40_000;

interface DrawData {
  solved: number;
  /** guessed within 15s at least once */
  fast: [boolean, boolean];
  /** guessed within 10s at least once */
  flash: [boolean, boolean];
  /** own drawing was guessed within 15s */
  clear: [boolean, boolean];
}
const data = (s: SessionState) => s.data as unknown as DrawData;

/** Faster guesses are worth more; the artist shares the credit. */
export function drawPoints(secs: number): { guesser: number; drawer: number } {
  const guesser = secs <= 15 ? 10 : secs <= 30 ? 8 : secs <= 50 ? 6 : 4;
  return { guesser, drawer: Math.ceil(guesser / 2) };
}

function startDrawing(r: DrawRound, index: number, now: number) {
  r.word = r.choices[index];
  r.step = "draw";
  r.drawAt = now;
}

function isCorrect(r: DrawRound, guess: string): boolean {
  const key = wordKey(guess);
  if (!key || !r.word) return false;
  return [r.word.w, ...(r.word.a ?? [])].some((w) => wordKey(w) === key);
}

/** «خمن الرسمة» — one draws a secret word, the other guesses; roles alternate. */
export const draw: GameModule = {
  id: "draw",
  rounds: 4,

  init(s) {
    s.data = {
      solved: 0,
      fast: [false, false],
      flash: [false, false],
      clear: [false, false],
    } satisfies DrawData as unknown as Record<string, unknown>;
  },

  begin(s, _ctx, pick) {
    const choices = pick(DRAW_WORDS, 3).map(({ w, a }) => ({ w, ...(a ? { a } : {}) }));
    const round: DrawRound = {
      g: "draw",
      drawer: ((s.host + s.round) % 2) as 0 | 1,
      step: "choose",
      choices,
      word: null,
      guesses: [],
      drawAt: null,
      solvedAt: null,
      hint: false,
    };
    return { round, ms: CHOOSE_MS };
  },

  action(s, seat, a, ctx) {
    const r = s.cur as DrawRound;
    if (a.t === "choose") {
      if (seat !== r.drawer || r.step !== "choose") throw BAD_ACTION();
      startDrawing(r, asIndex(a.i, r.choices.length), ctx.now);
      return { ms: DRAW_MS };
    }
    if (a.t === "guess") {
      if (seat === r.drawer || r.step !== "draw") throw BAD_ACTION();
      const text = cleanText(a.text, GUESS_MAX);
      if (!text) throw BAD_ACTION();
      if (isCorrect(r, text)) {
        r.solvedAt = ctx.now;
        return "resolve";
      }
      if (r.guesses.length < MAX_GUESSES) {
        r.guesses.push({ text, close: closeness(text, r.word?.w ?? "") === "close", at: ctx.now });
      }
      return "ok";
    }
    throw BAD_ACTION();
  },

  timeout(s, ctx) {
    const r = s.cur as DrawRound;
    if (r.step === "choose") {
      startDrawing(r, 0, ctx.now);
      return { ms: DRAW_MS };
    }
    return "resolve";
  },

  tick(s, ctx) {
    const r = s.cur as DrawRound;
    if (r.step === "draw" && !r.hint && r.drawAt !== null && ctx.now >= r.drawAt + HINT_AFTER_MS) {
      r.hint = true;
      return true;
    }
    return false;
  },

  wake(s) {
    const r = s.cur as DrawRound;
    return r.step === "draw" && !r.hint && r.drawAt !== null ? r.drawAt + HINT_AFTER_MS : null;
  },

  resolve(s) {
    const r = s.cur as DrawRound;
    const d = data(s);
    const guesser = other(r.drawer);
    const pts: [number, number] = [0, 0];
    let secs: number | null = null;
    if (r.solvedAt !== null && r.drawAt !== null) {
      secs = Math.max(1, Math.round((r.solvedAt - r.drawAt) / 1000));
      const p = drawPoints(secs);
      pts[guesser] = p.guesser;
      pts[r.drawer] = p.drawer;
      d.solved += 1;
      if (secs <= 15) {
        d.fast[guesser] = true;
        d.clear[r.drawer] = true;
      }
      if (secs <= 10) d.flash[guesser] = true;
    }
    s.score[0] += pts[0];
    s.score[1] += pts[1];
    const log: DrawLog = {
      g: "draw",
      turn: s.round,
      drawer: r.drawer,
      word: r.word?.w ?? "",
      solved: secs !== null,
      secs,
      pts,
    };
    return { log, revealMs: 12_000 };
  },

  view(s, seat) {
    const r = s.cur as DrawRound;
    const mine = seat === r.drawer;
    const word = r.word?.w ?? "";
    return {
      g: "draw",
      drawer: r.drawer,
      step: r.step,
      choices: mine && r.step === "choose" ? r.choices.map((c) => c.w) : null,
      word: mine && r.word ? word : null,
      shape: r.word ? word.split(/\s+/).filter(Boolean).map(letterCount) : [],
      hint: !mine && r.hint && word ? Array.from(word)[0] : null,
      guesses: r.guesses,
      drawAt: r.drawAt,
    };
  },

  outcome(s) {
    const d = data(s);
    return {
      coop: false,
      winner: winnerOf(s.score),
      hard: [d.flash[0], d.flash[1]],
      team: d.solved === s.totalRounds,
      headline: `${d.solved} رسمات اتخمنت من ${s.totalRounds}`,
      facts: {
        solved: d.solved,
        flash0: d.flash[0],
        flash1: d.flash[1],
        clear0: d.clear[0],
        clear1: d.clear[1],
        allSolved: d.solved === s.totalRounds,
      },
    };
  },
};
