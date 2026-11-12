import { NOYES_QUESTIONS } from "../content/noyes";
import { cleanText } from "../profile";
import { findForbidden, wordKey } from "../text";
import type { NoYesLog, NoYesRound, NoYesVerdict, SessionState } from "../types";
import { other, SEATS } from "../types";
import { ALREADY, BAD_ACTION, type GameModule, winnerOf } from "./module";

export const NOYES_LIVES = 3;
const ANSWER_MAX = 60;
/** The clock gets tighter as the round goes on. */
const SECONDS = [15, 15, 13, 13, 11, 11, 10];

interface NoYesData {
  lives: [number, number];
  /** canonical answers each player already used (repeating one costs a heart) */
  said: [string[], string[]];
}

const data = (s: SessionState) => s.data as unknown as NoYesData;

export function judgeNoYes(answer: string, said: string[]): { verdict: NoYesVerdict; bad: string | null; key: string } {
  const key = wordKey(answer);
  if (Array.from(key).length < 2) return { verdict: "empty", bad: null, key };
  const bad = findForbidden(answer);
  if (bad) return { verdict: "forbidden", bad, key };
  if (said.includes(key)) return { verdict: "repeat", bad: null, key };
  return { verdict: "ok", bad: null, key };
}

/** «ممنوع آه ولا لأ» — both answer the same quick question; slips cost hearts. */
export const noyes: GameModule = {
  id: "noyes",
  rounds: 7,

  init(s) {
    s.data = { lives: [NOYES_LIVES, NOYES_LIVES], said: [[], []] } satisfies NoYesData as unknown as Record<string, unknown>;
  },

  begin(s, _ctx, pick) {
    const [q] = pick(NOYES_QUESTIONS);
    const round: NoYesRound = { g: "noyes", qid: q.id, text: q.q, ans: [null, null] };
    return { round, ms: (SECONDS[s.round] ?? 10) * 1000 };
  },

  action(s, seat, a) {
    const r = s.cur as NoYesRound;
    if (a.t !== "answer") throw BAD_ACTION();
    if (r.ans[seat] !== null) throw ALREADY();
    r.ans[seat] = cleanText(a.text, ANSWER_MAX);
    return r.ans[other(seat)] !== null ? "resolve" : "ok";
  },

  timeout() {
    return "resolve";
  },

  resolve(s) {
    const r = s.cur as NoYesRound;
    const d = data(s);
    const ans = SEATS.map((x) => r.ans[x] ?? "") as [string, string];
    const verdict: NoYesVerdict[] = [];
    const bad: (string | null)[] = [];
    for (const x of SEATS) {
      const j = judgeNoYes(ans[x], d.said[x]);
      verdict[x] = j.verdict;
      bad[x] = j.bad;
      if (j.verdict === "ok") {
        d.said[x].push(j.key);
        s.score[x] += 1;
      } else {
        d.lives[x] = Math.max(0, d.lives[x] - 1);
      }
    }
    const log: NoYesLog = {
      g: "noyes",
      text: r.text,
      ans,
      verdict: verdict as [NoYesVerdict, NoYesVerdict],
      bad: bad as [string | null, string | null],
      lives: [d.lives[0], d.lives[1]],
    };
    return { log, revealMs: 15_000, over: d.lives[0] === 0 || d.lives[1] === 0 };
  },

  view(s, seat) {
    const r = s.cur as NoYesRound;
    const d = data(s);
    return {
      g: "noyes",
      text: r.text,
      mine: r.ans[seat],
      partnerDone: r.ans[other(seat)] !== null,
      lives: [d.lives[0], d.lives[1]],
    };
  },

  outcome(s) {
    const d = data(s);
    const lives: [number, number] = [d.lives[0], d.lives[1]];
    const survived = lives[0] > 0 && lives[1] > 0;
    const playedAll = s.log.length >= s.totalRounds;
    return {
      coop: false,
      winner: winnerOf(lives),
      hard: [lives[0] === NOYES_LIVES && playedAll, lives[1] === NOYES_LIVES && playedAll],
      // mission: reach the end with at most one slip each
      team: playedAll && lives[0] >= NOYES_LIVES - 1 && lives[1] >= NOYES_LIVES - 1,
      headline: survived ? "صمدتوا للآخر!" : "حد وقع في الفخ",
      facts: { survived: survived && playedAll, lives0: lives[0], lives1: lives[1] },
    };
  },
};
