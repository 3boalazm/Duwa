import { WORD_TOPICS } from "../content/word";
import { cleanText } from "../profile";
import { closeness } from "../text";
import type { SessionState, WordLog, WordRound } from "../types";
import { other } from "../types";
import { ALREADY, BAD_ACTION, type GameModule } from "./module";

const ANSWER_MAX = 30;

interface WordData {
  exact: number;
  close: number;
  /** longest run of exact matches */
  run: number;
  bestRun: number;
}
const data = (s: SessionState) => s.data as unknown as WordData;

/** «أول كلمة» — co-op: write the same word as your partner. */
export const word: GameModule = {
  id: "word",
  rounds: 6,

  init(s) {
    s.data = { exact: 0, close: 0, run: 0, bestRun: 0 } satisfies WordData as unknown as Record<string, unknown>;
  },

  begin(_s, _ctx, pick) {
    const [topic] = pick(WORD_TOPICS);
    const round: WordRound = { g: "word", qid: topic.id, text: topic.t, ans: [null, null] };
    return { round, ms: 15_000 };
  },

  action(s, seat, a) {
    const r = s.cur as WordRound;
    if (a.t !== "answer") throw BAD_ACTION();
    if (r.ans[seat] !== null) throw ALREADY();
    r.ans[seat] = cleanText(a.text, ANSWER_MAX);
    return r.ans[other(seat)] !== null ? "resolve" : "ok";
  },

  timeout() {
    return "resolve";
  },

  resolve(s) {
    const r = s.cur as WordRound;
    const d = data(s);
    const ans: [string, string] = [r.ans[0] ?? "", r.ans[1] ?? ""];
    const match = closeness(ans[0], ans[1]);
    if (match === "exact") {
      d.exact += 1;
      d.run += 1;
      d.bestRun = Math.max(d.bestRun, d.run);
      s.team += 2;
    } else {
      d.run = 0;
      if (match === "close") {
        d.close += 1;
        s.team += 1;
      }
    }
    const log: WordLog = { g: "word", text: r.text, ans, match };
    return { log, revealMs: 12_000 };
  },

  view(s, seat) {
    const r = s.cur as WordRound;
    return { g: "word", text: r.text, mine: r.ans[seat], partnerDone: r.ans[other(seat)] !== null };
  },

  outcome(s) {
    const d = data(s);
    const hard = d.exact >= 5;
    return {
      coop: true,
      winner: null,
      hard: [hard, hard],
      team: d.exact >= 3,
      headline: `توافق تام ${d.exact} من ${s.totalRounds}`,
      facts: { exact: d.exact, close: d.close, bestRun: d.bestRun },
    };
  },
};
