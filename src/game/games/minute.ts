import { MINUTE_ALL, MINUTE_DICT, MINUTE_OPEN } from "../content/minute";
import { cleanText } from "../profile";
import { wordKey } from "../text";
import type { MinuteEntry, MinuteLog, MinuteRound, SessionState } from "../types";
import { GameError, other, SEATS } from "../types";
import { BAD_ACTION, type GameModule, winnerOf } from "./module";

const ENTRY_MAX = 24;
const MAX_ENTRIES = 30;
const WRITE_MS = 60_000;
const REVIEW_MS = 30_000;
/** combined valid answers across both challenges for the co-op mission */
export const MINUTE_TEAM_TARGET = 20;

interface MinuteData {
  hit: [boolean, boolean];
  best: [number, number];
}
const data = (s: SessionState) => s.data as unknown as MinuteData;

const valid = (list: MinuteEntry[]) => list.filter((e) => e.st !== "no").length;
const dictOf = (r: MinuteRound) => MINUTE_ALL.find((c) => c.id === r.cid)?.dict;

function startReview(r: MinuteRound): boolean {
  const pending = SEATS.map((x) => r.entries[x].some((e) => e.st === "ask"));
  if (!pending[0] && !pending[1]) return false;
  r.step = "review";
  // A player with nothing to judge is done immediately.
  r.reviewed = [!pending[1], !pending[0]];
  return true;
}

/** «تحدي الدقيقة» — 60 seconds to list as many valid answers as you can. */
export const minute: GameModule = {
  id: "minute",
  rounds: 2,

  init(s) {
    s.data = { hit: [false, false], best: [0, 0] } satisfies MinuteData as unknown as Record<string, unknown>;
  },

  begin(s, _ctx, pick) {
    // First a dictionary challenge (instant checking), then an open one (partner judges).
    const [ch] = pick(s.round % 2 === 0 ? MINUTE_DICT : MINUTE_OPEN);
    const round: MinuteRound = {
      g: "minute",
      cid: ch.id,
      title: ch.title,
      target: ch.target,
      step: "write",
      entries: [[], []],
      reviewed: [false, false],
    };
    return { round, ms: WRITE_MS };
  },

  action(s, seat, a) {
    const r = s.cur as MinuteRound;
    if (a.t === "entry") {
      if (r.step !== "write") throw new GameError("time_up", "الوقت خلص!");
      const text = cleanText(a.text, ENTRY_MAX);
      const key = wordKey(text);
      if (Array.from(key).length < 2) throw new GameError("empty", "اكتب كلمة الأول.");
      const list = r.entries[seat];
      if (list.length >= MAX_ENTRIES) throw new GameError("full", "وصلت لأقصى عدد إجابات.");
      if (list.some((e) => e.key === key)) throw new GameError("dup", "كتبت الإجابة دي قبل كده.");
      list.push({ text, key, st: dictOf(r)?.has(key) ? "ok" : "ask" });
      return "ok";
    }
    if (a.t === "review") {
      if (r.step !== "review") throw BAD_ACTION();
      if (r.reviewed[seat]) return "ok";
      const theirs = r.entries[other(seat)];
      const reject = Array.isArray(a.reject) ? a.reject : [];
      for (const i of reject) {
        if (typeof i === "number" && Number.isInteger(i) && theirs[i]?.st === "ask") theirs[i].st = "no";
      }
      r.reviewed[seat] = true;
      return r.reviewed[other(seat)] ? "resolve" : "ok";
    }
    throw BAD_ACTION();
  },

  timeout(s) {
    const r = s.cur as MinuteRound;
    if (r.step === "write" && startReview(r)) {
      return r.reviewed[0] && r.reviewed[1] ? "resolve" : { ms: REVIEW_MS };
    }
    if (r.step === "review" && dictOf(r)) {
      // No verdict in time: in a dictionary challenge an unknown answer does not count.
      // (In open challenges the benefit of the doubt goes to the writer.)
      for (const judge of SEATS) {
        if (r.reviewed[judge]) continue;
        for (const e of r.entries[other(judge)]) if (e.st === "ask") e.st = "no";
      }
    }
    return "resolve";
  },

  resolve(s) {
    const r = s.cur as MinuteRound;
    const d = data(s);
    const count = SEATS.map((x) => valid(r.entries[x])) as [number, number];
    for (const x of SEATS) {
      s.score[x] += count[x];
      d.best[x] = Math.max(d.best[x], count[x]);
      if (count[x] >= r.target) d.hit[x] = true;
    }
    const log: MinuteLog = {
      g: "minute",
      title: r.title,
      target: r.target,
      lists: SEATS.map((x) => r.entries[x].map((e) => ({ text: e.text, st: e.st }))) as MinuteLog["lists"],
      count,
    };
    return { log, revealMs: 25_000 };
  },

  view(s, seat) {
    const r = s.cur as MinuteRound;
    const theirs = r.entries[other(seat)];
    const dict = !!dictOf(r);
    return {
      g: "minute",
      title: r.title,
      target: r.target,
      dict,
      step: r.step,
      mine: r.entries[seat].map((e) => ({ text: e.text, st: e.st })),
      partnerCount: dict ? theirs.filter((e) => e.st === "ok").length : theirs.length,
      partnerPending: dict ? theirs.filter((e) => e.st === "ask").length : 0,
      toJudge:
        r.step === "review" && !r.reviewed[seat]
          ? theirs.map((e, i) => ({ i, text: e.text, st: e.st })).filter((e) => e.st === "ask").map(({ i, text }) => ({ i, text }))
          : [],
      reviewed: [r.reviewed[0], r.reviewed[1]],
    };
  },

  outcome(s) {
    const d = data(s);
    const total = s.score[0] + s.score[1];
    return {
      coop: false,
      winner: winnerOf(s.score),
      hard: [d.hit[0], d.hit[1]],
      team: total >= MINUTE_TEAM_TARGET,
      headline: `${total} إجابة صح مع بعض`,
      facts: { total, best0: d.best[0], best1: d.best[1] },
    };
  },
};
