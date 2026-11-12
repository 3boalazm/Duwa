import { GUESS_QUESTIONS } from "../content/guess";
import type { GuessLog, GuessRound } from "../types";
import { other, SEATS } from "../types";
import { ALREADY, asIndex, BAD_ACTION, type GameModule, winnerOf } from "./module";

/** «خمن إجابتي» — answer for yourself, then predict your partner. */
export const guess: GameModule = {
  id: "guess",
  rounds: 5,

  init() {},

  begin(_s, _ctx, pick) {
    const [q] = pick(GUESS_QUESTIONS);
    const round: GuessRound = { g: "guess", qid: q.id, text: q.q, options: [...q.o], ans: [null, null] };
    return { round, ms: 35_000 };
  },

  action(s, seat, a) {
    const r = s.cur as GuessRound;
    if (a.t !== "answer") throw BAD_ACTION();
    if (r.ans[seat]) throw ALREADY();
    r.ans[seat] = { mine: asIndex(a.mine, r.options.length), guess: asIndex(a.guess, r.options.length) };
    return r.ans[other(seat)] ? "resolve" : "ok";
  },

  timeout() {
    return "resolve";
  },

  resolve(s) {
    const r = s.cur as GuessRound;
    const mine = SEATS.map((x) => r.ans[x]?.mine ?? -1) as [number, number];
    const picked = SEATS.map((x) => r.ans[x]?.guess ?? -1) as [number, number];
    const hit = SEATS.map((x) => picked[x] >= 0 && picked[x] === mine[other(x)]) as [boolean, boolean];
    for (const x of SEATS) if (hit[x]) s.score[x] += 1;
    if (hit[0] && hit[1]) s.team += 1;
    const log: GuessLog = { g: "guess", text: r.text, options: r.options, mine, guess: picked, hit };
    return { log, revealMs: 20_000 };
  },

  view(s, seat) {
    const r = s.cur as GuessRound;
    return { g: "guess", text: r.text, options: r.options, mine: r.ans[seat], partnerDone: !!r.ans[other(seat)] };
  },

  outcome(s) {
    const total = s.score[0] + s.score[1];
    return {
      coop: false,
      winner: winnerOf(s.score),
      hard: [s.score[0] === s.totalRounds, s.score[1] === s.totalRounds],
      team: total >= 7,
      headline: `${total} توقع صح من ${s.totalRounds * 2}`,
      facts: { hits: total, perfect0: s.score[0] === s.totalRounds, perfect1: s.score[1] === s.totalRounds },
    };
  },
};
