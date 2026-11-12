import { ENVELOPE_CARDS } from "../content/envelope";
import { cleanText } from "../profile";
import type { EnvelopeAnswer, EnvelopeLog, EnvelopeRound, SessionState } from "../types";
import { other, SEATS } from "../types";
import { ALREADY, BAD_ACTION, type GameModule } from "./module";

const ANSWER_MAX = 240;
const SEAL_MS = 25_000;
const OPEN_MS = 100_000;
const WHO_MS = 25_000;
/** Card kinds by round: quick «مين فينا» cards alternate with open questions. */
const KINDS: Array<"open" | "who"> = ["who", "open", "who", "open"];

interface EnvelopeData {
  agree: number;
  who: number;
  blanks: number;
}
const data = (s: SessionState) => s.data as unknown as EnvelopeData;

const answerMs = (r: EnvelopeRound) => (r.kind === "open" ? OPEN_MS : WHO_MS);
const isBlank = (a: EnvelopeAnswer | null) => !a || "skip" in a;

/** «الظرف المجهول» — open the envelope together, answer in secret, reveal together. */
export const envelope: GameModule = {
  id: "envelope",
  rounds: KINDS.length,

  init(s) {
    s.data = { agree: 0, who: 0, blanks: 0 } satisfies EnvelopeData as unknown as Record<string, unknown>;
  },

  begin(s, _ctx, pick) {
    const kind = KINDS[s.round % KINDS.length];
    const [card] = pick(ENVELOPE_CARDS.filter((c) => c.kind === kind));
    const round: EnvelopeRound = {
      g: "envelope",
      cid: card.id,
      kind,
      text: card.t,
      step: "sealed",
      opened: [false, false],
      ans: [null, null],
    };
    return { round, ms: SEAL_MS };
  },

  action(s, seat, a) {
    const r = s.cur as EnvelopeRound;
    if (a.t === "open") {
      if (r.step !== "sealed") return "ok";
      r.opened[seat] = true;
      if (r.opened[0] && r.opened[1]) {
        r.step = "answer";
        return { ms: answerMs(r) };
      }
      return "ok";
    }
    if (a.t !== "answer" || r.step !== "answer") throw BAD_ACTION();
    if (r.ans[seat]) throw ALREADY();
    if (r.kind === "who") {
      if (a.who !== 0 && a.who !== 1) throw BAD_ACTION();
      r.ans[seat] = { who: a.who };
    } else {
      const text = cleanText(a.text, ANSWER_MAX);
      r.ans[seat] = text ? { text } : { skip: true };
    }
    return r.ans[other(seat)] ? "resolve" : "ok";
  },

  timeout(s) {
    const r = s.cur as EnvelopeRound;
    if (r.step === "sealed") {
      // Nobody should be stuck on a sealed envelope: it opens by itself.
      r.step = "answer";
      r.opened = [true, true];
      return { ms: answerMs(r) };
    }
    return "resolve";
  },

  resolve(s) {
    const r = s.cur as EnvelopeRound;
    const d = data(s);
    const ans = SEATS.map((x) => r.ans[x] ?? { skip: true }) as [EnvelopeAnswer, EnvelopeAnswer];
    d.blanks += ans.filter(isBlank).length;
    let agree: boolean | null = null;
    if (r.kind === "who") {
      d.who += 1;
      agree = "who" in ans[0] && "who" in ans[1] && ans[0].who === ans[1].who;
      if (agree) {
        d.agree += 1;
        s.team += 1;
      }
    }
    const log: EnvelopeLog = { g: "envelope", kind: r.kind, text: r.text, ans, agree };
    return { log, revealMs: r.kind === "open" ? 90_000 : 15_000 };
  },

  view(s, seat) {
    const r = s.cur as EnvelopeRound;
    const sealed = r.step === "sealed";
    return {
      g: "envelope",
      step: r.step,
      opened: [r.opened[0], r.opened[1]],
      kind: sealed ? null : r.kind,
      text: sealed ? null : r.text,
      mine: r.ans[seat],
      partnerDone: !!r.ans[other(seat)],
    };
  },

  outcome(s) {
    const d = data(s);
    return {
      coop: true,
      winner: null,
      hard: [false, false],
      // mission: answer everything and agree on every «مين فينا» card
      team: d.blanks === 0 && d.who > 0 && d.agree === d.who,
      headline: d.who ? `اتفقتوا في ${d.agree} من ${d.who}` : "جولة مكتملة",
      facts: { blanks: d.blanks, agree: d.agree, agreeAll: d.who > 0 && d.agree === d.who },
    };
  },
};
