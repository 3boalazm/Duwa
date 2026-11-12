import { describe, expect, it } from "vitest";
import { POINTS } from "@/game/catalog";
import { COUNTDOWN_MS, leave, next, nextWake, play, propose, respond, RESUME_GRACE_MS, sessionView, tick } from "@/game/engine";
import type { DrawRound, EnvelopeRound, GuessRound, MinuteRound, NoYesRound, RoomAgg, Seat, WordRound } from "@/game/types";
import { GameError } from "@/game/types";
import type { DrawView, GuessView, MinuteView } from "@/game/views";
import { makeCtx, makeRoom } from "./helpers";

type TestCtx = ReturnType<typeof makeCtx>;

/** Invite + accept + countdown → first round is in play. */
function start(agg: RoomAgg, ctx: TestCtx, gameId: string, host: Seat = 0) {
  propose(agg, host, gameId, ctx);
  respond(agg, host === 0 ? 1 : 0, true, ctx);
  expect(agg.session?.phase).toBe("countdown");
  ctx.advance(COUNTDOWN_MS);
  expect(tick(agg, ctx)).toBe(true);
  expect(agg.session?.phase).toBe("play");
}

function bothNext(agg: RoomAgg, ctx: TestCtx) {
  next(agg, 0, ctx);
  next(agg, 1, ctx);
}

describe("session lifecycle", () => {
  it("needs two players, a playable and unlocked game, and no running round", () => {
    const ctx = makeCtx();
    expect(() => propose(makeRoom({ solo: true }), 0, "guess", ctx)).toThrow(GameError);
    const agg = makeRoom();
    expect(() => propose(agg, 0, "rps", ctx)).toThrow(/تحديث/);
    expect(() => propose(agg, 0, "word", ctx)).toThrow(/مقفولة/);
    propose(agg, 0, "guess", ctx);
    expect(() => propose(agg, 1, "noyes", ctx)).toThrow(/شغالة/);
  });

  it("only the invited player can accept, and declining clears the table", () => {
    const ctx = makeCtx();
    const agg = makeRoom();
    propose(agg, 0, "guess", ctx);
    expect(() => respond(agg, 0, true, ctx)).toThrow(GameError);
    respond(agg, 1, false, ctx);
    expect(agg.session).toBeNull();
    expect(agg.progress.flash?.kind).toBe("declined");
    expect(ctx.fx.closed).toEqual([{ id: "id1", status: "aborted", summary: null }]);
  });

  it("quitting mid-round awards nothing", () => {
    const ctx = makeCtx();
    const agg = makeRoom();
    start(agg, ctx, "guess");
    leave(agg, 1, ctx);
    expect(agg.session).toBeNull();
    expect(agg.shared).toBe(0);
    expect(ctx.fx.scores).toHaveLength(0);
  });
});

describe("خمن إجابتي", () => {
  it("hides the partner's answer until both have answered, and ignores re-submissions", () => {
    const ctx = makeCtx();
    const agg = makeRoom();
    start(agg, ctx, "guess");
    const s = agg.session!;

    play(agg, 0, { t: "answer", mine: 2, guess: 1 }, ctx);
    const seenByPartner = sessionView(s, 1);
    expect(JSON.stringify(seenByPartner)).not.toContain('"mine":2');
    expect((seenByPartner.cur as GuessView).mine).toBeNull();
    expect((seenByPartner.cur as GuessView).partnerDone).toBe(true);
    expect(seenByPartner.log).toHaveLength(0);

    // a second submission must not replace the first one
    expect(() => play(agg, 0, { t: "answer", mine: 0, guess: 0 }, ctx)).toThrow(/اتسجلت/);
    expect((s.cur as GuessRound).ans[0]).toEqual({ mine: 2, guess: 1 });

    play(agg, 1, { t: "answer", mine: 1, guess: 3 }, ctx);
    expect(s.phase).toBe("reveal");
    expect(s.log[0]).toMatchObject({ g: "guess", mine: [2, 1], guess: [1, 3], hit: [true, false] });
    expect(s.score).toEqual([1, 0]);
  });

  it("rejects malformed answers", () => {
    const ctx = makeCtx();
    const agg = makeRoom();
    start(agg, ctx, "guess");
    expect(() => play(agg, 0, { t: "answer", mine: 9, guess: 0 }, ctx)).toThrow(GameError);
    expect(() => play(agg, 0, { t: "answer", mine: "1", guess: 0 }, ctx)).toThrow(GameError);
    expect(() => play(agg, 0, { t: "open" }, ctx)).toThrow(GameError);
  });

  it("times out to blank answers and plays through to a settled result", () => {
    const ctx = makeCtx();
    const agg = makeRoom();
    start(agg, ctx, "guess");
    const s = agg.session!;

    // round 1: nobody answers
    ctx.advance(s.phaseMs!);
    tick(agg, ctx);
    expect(s.phase).toBe("reveal");
    expect(s.log[0]).toMatchObject({ mine: [-1, -1], hit: [false, false] });

    // reveal runs out by itself
    ctx.advance(s.phaseMs!);
    tick(agg, ctx);
    expect(s.phase).toBe("play");
    expect(s.round).toBe(1);

    // remaining rounds: player 0 always guesses right, player 1 never
    while (s.phase !== "done") {
      play(agg, 0, { t: "answer", mine: 0, guess: 1 }, ctx);
      play(agg, 1, { t: "answer", mine: 1, guess: 1 }, ctx);
      bothNext(agg, ctx);
    }
    const r = s.result!;
    expect(r.score).toEqual([4, 0]);
    expect(r.winner).toBe(0);
    expect(r.coop).toBe(false);

    const byReason = (to: number, reason: string) => r.awards.filter((a) => a.to === to && a.reason === reason).length;
    expect(byReason(0, "complete")).toBe(1);
    expect(byReason(1, "complete")).toBe(1);
    expect(byReason(0, "win")).toBe(1);
    expect(byReason(1, "win")).toBe(0);

    // personal points are separate; the shared balance is everything earned together
    const total = r.awards.reduce((sum, a) => sum + a.points, 0);
    expect(agg.shared).toBe(total);
    expect(r.sharedAfter - r.sharedBefore).toBe(total);
    expect(agg.players[0]!.points).toBe(r.earned[0]);
    expect(agg.players[1]!.points).toBe(r.earned[1]);
    expect(r.earned[0]).toBeGreaterThan(r.earned[1]);
    expect(r.earned[1]).toBeGreaterThanOrEqual(POINTS.complete); // losing never costs points

    // first session ever: duo badge + first journey stage
    expect(r.achievements).toContainEqual({ key: "first_step", to: 2 });
    expect(r.achievements).toContainEqual({ key: "first_win", to: 0 });
    expect(r.journey).toEqual(["start"]);
    expect(agg.progress.journey).toBe(1);
    expect(agg.players[0]!.stats).toMatchObject({ wins: 1, losses: 0, streak: 1, sessions: 1 });
    expect(agg.players[1]!.stats).toMatchObject({ wins: 0, losses: 1, streak: 0, sessions: 1 });

    // every award has a unique ledger key (the database enforces it too)
    const keys = ctx.fx.scores.map((x) => x.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ctx.fx.closed.at(-1)).toMatchObject({ status: "finished" });

    // asking again changes nothing
    const before = agg.shared;
    next(agg, 0, ctx);
    tick(agg, ctx);
    expect(agg.shared).toBe(before);
  });

  it("does not repeat questions inside a room until the pool is exhausted", () => {
    const ctx = makeCtx();
    const agg = makeRoom();
    const asked = new Set<string>();
    for (let game = 0; game < 4; game++) {
      start(agg, ctx, "guess");
      const s = agg.session!;
      while (s.phase !== "done") {
        asked.add((s.cur as GuessRound).qid);
        play(agg, 0, { t: "answer", mine: 0, guess: 0 }, ctx);
        play(agg, 1, { t: "answer", mine: 0, guess: 0 }, ctx);
        bothNext(agg, ctx);
      }
    }
    expect(asked.size).toBe(20);
  });
});

describe("disconnects", () => {
  it("freezes the clock while a player is away and resumes with a grace period", () => {
    const ctx = makeCtx();
    const agg = makeRoom();
    start(agg, ctx, "guess");
    const s = agg.session!;
    const total = s.phaseMs!;

    ctx.advance(10_000);
    agg.players[1]!.seenUntil = ctx.now - 1; // player 1 dropped
    expect(tick(agg, ctx)).toBe(true);
    expect(s.pause).toMatchObject({ seat: 1, remainingMs: total - 10_000 });
    expect(s.endsAt).toBeNull();
    expect(nextWake(agg)).toBeNull();

    // a long time passes: nothing times out, and the present player's answer is kept
    ctx.advance(10 * 60_000);
    play(agg, 0, { t: "answer", mine: 1, guess: 1 }, ctx);
    expect(tick(agg, ctx)).toBe(false);
    expect(s.phase).toBe("play");
    expect(s.round).toBe(0);

    // player 1 is back: same question, time left restored
    agg.players[1]!.seenUntil = Number.MAX_SAFE_INTEGER;
    expect(tick(agg, ctx)).toBe(true);
    expect(s.pause).toBeNull();
    expect(s.endsAt).toBe(ctx.now + (total - 10_000));
    expect((s.cur as GuessRound).ans[0]).toEqual({ mine: 1, guess: 1 });

    play(agg, 1, { t: "answer", mine: 1, guess: 1 }, ctx);
    expect(s.phase).toBe("reveal");
    expect(s.score).toEqual([1, 1]);
  });

  it("gives at least the grace period when the clock had almost run out", () => {
    const ctx = makeCtx();
    const agg = makeRoom();
    start(agg, ctx, "guess");
    const s = agg.session!;
    ctx.advance(s.phaseMs! + 5_000); // deadline passed while player 0 was gone
    agg.players[0]!.seenUntil = ctx.now - 1;
    tick(agg, ctx);
    expect(s.phase).toBe("play");
    expect(s.pause?.remainingMs).toBe(0);
    agg.players[0]!.seenUntil = Number.MAX_SAFE_INTEGER;
    tick(agg, ctx);
    expect(s.endsAt).toBe(ctx.now + RESUME_GRACE_MS);
  });
});

describe("ممنوع آه ولا لأ", () => {
  it("takes a heart for forbidden, empty and repeated answers and ends at zero hearts", () => {
    const ctx = makeCtx();
    const agg = makeRoom();
    start(agg, ctx, "noyes");
    const s = agg.session!;
    const lives = () => (s.data as { lives: [number, number] }).lives;

    play(agg, 0, { t: "answer", text: "أكيد يا باشا" }, ctx);
    play(agg, 1, { t: "answer", text: "آه طبعًا" }, ctx);
    expect(s.log[0]).toMatchObject({ verdict: ["ok", "forbidden"], bad: [null, "اه"] });
    expect(lives()).toEqual([3, 2]);
    bothNext(agg, ctx);

    play(agg, 0, { t: "answer", text: "اكيد يا باشا" }, ctx); // same answer again
    play(agg, 1, { t: "answer", text: "" }, ctx);
    expect(s.log[1]).toMatchObject({ verdict: ["repeat", "empty"] });
    expect(lives()).toEqual([2, 1]);
    bothNext(agg, ctx);

    expect((s.cur as NoYesRound).ans).toEqual([null, null]);
    play(agg, 0, { t: "answer", text: "ممكن" }, ctx);
    play(agg, 1, { t: "answer", text: "لأ" }, ctx);
    expect(lives()).toEqual([2, 0]);
    bothNext(agg, ctx);

    expect(s.phase).toBe("done");
    expect(s.result).toMatchObject({ winner: 0 });
    expect(s.log).toHaveLength(3);
  });
});

describe("أول كلمة (co-op)", () => {
  it("scores matches for the pair, has no winner and unlocks nothing early", () => {
    const ctx = makeCtx();
    const agg = makeRoom({ shared: 100 });
    start(agg, ctx, "word");
    const s = agg.session!;
    const answers: Array<[string, string]> = [
      ["البحر", "بحر"],
      ["قهوة", "قهوه"],
      ["سمك", "سمكة"],
      ["شمس", "قمر"],
      ["نوم", "النوم"],
      ["", "حاجة"],
    ];
    for (const [a, b] of answers) {
      expect((s.cur as WordRound).ans).toEqual([null, null]);
      play(agg, 0, { t: "answer", text: a }, ctx);
      play(agg, 1, { t: "answer", text: b }, ctx);
      bothNext(agg, ctx);
    }
    const r = s.result!;
    expect(s.log.map((l) => (l.g === "word" ? l.match : ""))).toEqual(["exact", "exact", "close", "none", "exact", "none"]);
    expect(r.coop).toBe(true);
    expect(r.winner).toBeNull();
    expect(r.team).toBe(7);
    expect(r.awards.filter((a) => a.reason === "win" || a.reason === "tie")).toHaveLength(0);
    expect(r.awards.filter((a) => a.reason === "team")).toEqual([
      { to: 2, reason: "team", points: POINTS.team, label: "مهمة جماعية" },
    ]);
    // co-op games do not touch the win/loss record
    expect(agg.players[0]!.stats).toMatchObject({ wins: 0, losses: 0, ties: 0, sessions: 1 });
  });
});

describe("الظرف المجهول", () => {
  it("keeps the question hidden until the envelope is opened by both", () => {
    const ctx = makeCtx();
    const agg = makeRoom();
    start(agg, ctx, "envelope");
    const s = agg.session!;
    const sealed = sessionView(s, 0).cur!;
    expect(sealed).toMatchObject({ g: "envelope", step: "sealed", text: null, kind: null });
    expect(() => play(agg, 0, { t: "answer", who: 0 }, ctx)).toThrow(GameError);

    play(agg, 0, { t: "open" }, ctx);
    expect((s.cur as EnvelopeRound).step).toBe("sealed");
    play(agg, 1, { t: "open" }, ctx);
    expect((s.cur as EnvelopeRound).step).toBe("answer");
    expect(sessionView(s, 0).cur).toMatchObject({ kind: "who" });

    play(agg, 0, { t: "answer", who: 1 }, ctx);
    play(agg, 1, { t: "answer", who: 1 }, ctx);
    expect(s.log[0]).toMatchObject({ g: "envelope", kind: "who", agree: true });
    bothNext(agg, ctx);

    // open question: sealed envelope opens by itself when the timer runs out
    ctx.advance(s.phaseMs!);
    tick(agg, ctx);
    expect((s.cur as EnvelopeRound).step).toBe("answer");
    play(agg, 0, { t: "answer", text: "لما بتضحك" }, ctx);
    const partnerView = JSON.stringify(sessionView(s, 1));
    expect(partnerView).not.toContain("لما بتضحك");
    play(agg, 1, { t: "answer", text: "   " }, ctx);
    expect(s.log[1]).toMatchObject({ kind: "open", ans: [{ text: "لما بتضحك" }, { skip: true }] });
  });
});

describe("co-op missions are earned, not automatic", () => {
  function playEnvelope(agree: boolean, blank: boolean) {
    const ctx = makeCtx();
    const agg = makeRoom();
    start(agg, ctx, "envelope");
    const s = agg.session!;
    while (s.phase !== "done") {
      play(agg, 0, { t: "open" }, ctx);
      play(agg, 1, { t: "open" }, ctx);
      const r = s.cur as EnvelopeRound;
      if (r.kind === "who") {
        play(agg, 0, { t: "answer", who: 0 }, ctx);
        play(agg, 1, { t: "answer", who: agree ? 0 : 1 }, ctx);
      } else {
        play(agg, 0, { t: "answer", text: "إجابة من القلب" }, ctx);
        play(agg, 1, { t: "answer", text: blank ? "" : "وأنا كمان" }, ctx);
      }
      bothNext(agg, ctx);
    }
    return { agg, result: s.result! };
  }
  const hasTeam = (r: { awards: { reason: string }[] }) => r.awards.some((a) => a.reason === "team");

  it("الظرف المجهول: needs every answer and full agreement", () => {
    const perfect = playEnvelope(true, false);
    expect(hasTeam(perfect.result)).toBe(true);
    expect(perfect.result.achievements).toContainEqual({ key: "one_heart", to: 2 });
    expect(perfect.result.headline).toBe("اتفقتوا في 2 من 2");

    expect(hasTeam(playEnvelope(false, false).result)).toBe(false);
    expect(hasTeam(playEnvelope(true, true).result)).toBe(false);
    // …but simply finishing still pays both players
    expect(playEnvelope(false, true).result.earned).toEqual([5, 5]);
  });

  it("ممنوع آه ولا لأ: at most one slip each", () => {
    const run = (slipsB: number) => {
      const ctx = makeCtx();
      const agg = makeRoom();
      start(agg, ctx, "noyes");
      const s = agg.session!;
      let i = 0;
      while (s.phase !== "done") {
        play(agg, 0, { t: "answer", text: `رد رقم ${i}` }, ctx);
        play(agg, 1, { t: "answer", text: i < slipsB ? "آه" : `كلام ${i}` }, ctx);
        i += 1;
        bothNext(agg, ctx);
      }
      return s.result!;
    };
    const clean = run(1);
    expect(hasTeam(clean)).toBe(true);
    expect(clean.winner).toBe(0);
    expect(clean.awards.filter((a) => a.reason === "hard").map((a) => a.to)).toEqual([0]); // kept all three hearts
    expect(hasTeam(run(2))).toBe(false);
  });
});

describe("تحدي الدقيقة", () => {
  it("accepts dictionary answers instantly and lets the partner judge the rest", () => {
    const ctx = makeCtx();
    const agg = makeRoom({ shared: 100 });
    start(agg, ctx, "minute");
    const s = agg.session!;
    const r = s.cur as MinuteRound;
    // force a known challenge so the test does not depend on the random pick
    r.cid = "m_animals";
    r.title = "اكتبوا 10 حيوانات";
    r.target = 10;

    for (const w of ["قطة", "كلب", "الأسد", "زرافه"]) play(agg, 0, { t: "entry", text: w }, ctx);
    play(agg, 0, { t: "entry", text: "ديناصور طائر" }, ctx);
    expect(() => play(agg, 0, { t: "entry", text: "قطه" }, ctx)).toThrow(/قبل كده/);
    expect(() => play(agg, 0, { t: "entry", text: " " }, ctx)).toThrow(GameError);
    play(agg, 1, { t: "entry", text: "فيل" }, ctx);
    play(agg, 1, { t: "entry", text: "بسكوت" }, ctx);

    const mine = sessionView(s, 0).cur as MinuteView;
    expect(mine.mine.map((e) => e.st)).toEqual(["ok", "ok", "ok", "ok", "ask"]);
    expect(mine).toMatchObject({ dict: true, partnerCount: 1, partnerPending: 1 });
    expect(JSON.stringify(mine)).not.toContain("بسكوت"); // partner's words stay hidden while writing

    ctx.advance(s.phaseMs!);
    tick(agg, ctx);
    expect(r.step).toBe("review");
    expect(() => play(agg, 0, { t: "entry", text: "نمر" }, ctx)).toThrow(/الوقت/);
    expect((sessionView(s, 0).cur as MinuteView).toJudge).toEqual([{ i: 1, text: "بسكوت" }]);

    play(agg, 0, { t: "review", reject: [1, 0] }, ctx); // cannot reject a dictionary answer (index 0)
    play(agg, 1, { t: "review", reject: [] }, ctx);
    expect(s.phase).toBe("reveal");
    expect(s.log[0]).toMatchObject({ g: "minute", count: [5, 1] });
    expect(s.score).toEqual([5, 1]);
  });

  it("drops unknown answers of a dictionary challenge when nobody judges them in time", () => {
    const ctx = makeCtx();
    const agg = makeRoom({ shared: 100 });
    start(agg, ctx, "minute");
    const s = agg.session!;
    (s.cur as MinuteRound).cid = "m_animals";
    play(agg, 0, { t: "entry", text: "قطة" }, ctx);
    play(agg, 0, { t: "entry", text: "حاجة مش حيوان" }, ctx);
    ctx.advance(s.phaseMs!);
    tick(agg, ctx);
    expect((s.cur as MinuteRound).step).toBe("review");
    ctx.advance(s.phaseMs!); // the judge never answered
    tick(agg, ctx);
    expect(s.phase).toBe("reveal");
    expect(s.log[0]).toMatchObject({ count: [1, 0], lists: [[{ st: "ok" }, { st: "no" }], []] });
  });

  it("gives the benefit of the doubt in open challenges", () => {
    const ctx = makeCtx();
    const agg = makeRoom({ shared: 100 });
    start(agg, ctx, "minute");
    const s = agg.session!;
    (s.cur as MinuteRound).cid = "o_white";
    play(agg, 1, { t: "entry", text: "تلج" }, ctx);
    play(agg, 1, { t: "entry", text: "لبن" }, ctx);
    expect((sessionView(s, 0).cur as MinuteView)).toMatchObject({ dict: false, partnerCount: 2, partnerPending: 0 });
    ctx.advance(s.phaseMs!);
    tick(agg, ctx);
    ctx.advance(s.phaseMs!);
    tick(agg, ctx);
    expect(s.log[0]).toMatchObject({ count: [0, 2] });
  });

  it("skips the review step when every answer is in the dictionary", () => {
    const ctx = makeCtx();
    const agg = makeRoom({ shared: 100 });
    start(agg, ctx, "minute");
    const s = agg.session!;
    (s.cur as MinuteRound).cid = "m_animals";
    play(agg, 0, { t: "entry", text: "قطة" }, ctx);
    ctx.advance(s.phaseMs!);
    tick(agg, ctx);
    expect(s.phase).toBe("reveal");
  });
});

describe("خمن الرسمة", () => {
  it("shows the word only to the artist and scores by speed", () => {
    const ctx = makeCtx();
    const agg = makeRoom();
    start(agg, ctx, "draw", 1); // host = seat 1 draws first
    const s = agg.session!;
    const r = s.cur as DrawRound;
    expect(r.drawer).toBe(1);

    const artist = sessionView(s, 1).cur as DrawView;
    const guesser = sessionView(s, 0).cur as DrawView;
    expect(artist.choices).toHaveLength(3);
    expect(guesser.choices).toBeNull();
    expect(() => play(agg, 0, { t: "choose", i: 0 }, ctx)).toThrow(GameError);

    play(agg, 1, { t: "choose", i: 1 }, ctx);
    const word = r.word!.w;
    expect((sessionView(s, 1).cur as DrawView).word).toBe(word);
    const hidden = sessionView(s, 0);
    expect((hidden.cur as DrawView).word).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain(word);
    expect((hidden.cur as DrawView).shape.length).toBeGreaterThan(0);
    expect(() => play(agg, 1, { t: "guess", text: word }, ctx)).toThrow(GameError); // artist cannot guess

    ctx.advance(12_000);
    play(agg, 0, { t: "guess", text: "حاجة غلط" }, ctx);
    expect(r.guesses).toHaveLength(1);
    play(agg, 0, { t: "guess", text: ` ${word}!! ` }, ctx);
    expect(s.phase).toBe("reveal");
    expect(s.log[0]).toMatchObject({ g: "draw", drawer: 1, word, solved: true, secs: 12, pts: [10, 5] });
    bothNext(agg, ctx);

    // next turn: roles swap, the first letter appears as a hint after a while
    const r2 = s.cur as DrawRound;
    expect(r2.drawer).toBe(0);
    ctx.advance(s.phaseMs!); // artist did not choose in time → first word is picked
    tick(agg, ctx);
    expect(r2.step).toBe("draw");
    expect((sessionView(s, 1).cur as DrawView).hint).toBeNull();
    ctx.advance(41_000);
    expect(tick(agg, ctx)).toBe(true);
    expect((sessionView(s, 1).cur as DrawView).hint).toBe(Array.from(r2.word!.w)[0]);
    ctx.advance(60_000);
    tick(agg, ctx);
    expect(s.log[1]).toMatchObject({ solved: false, pts: [0, 0] });
  });
});

describe("unlocks", () => {
  it("opens the next world automatically when the shared balance reaches its threshold", () => {
    const ctx = makeCtx();
    const agg = makeRoom({ shared: 95 });
    agg.unlocks = [
      { world: "laugh", at: 1 },
      { world: "know", at: 1 },
    ];
    expect(() => propose(agg, 0, "word", ctx)).toThrow(/مقفولة/);
    start(agg, ctx, "guess");
    const s = agg.session!;
    while (s.phase !== "done") {
      play(agg, 0, { t: "answer", mine: 0, guess: 0 }, ctx);
      play(agg, 1, { t: "answer", mine: 0, guess: 0 }, ctx);
      bothNext(agg, ctx);
    }
    expect(agg.shared).toBeGreaterThanOrEqual(100);
    expect(s.result!.unlocked).toEqual(["brain"]);
    expect(ctx.fx.unlocks.map((u) => u.world)).toEqual(["brain"]);
    // …and the game is now playable without anyone doing anything else
    propose(agg, 1, "word", ctx);
    expect(agg.session!.gameId).toBe("word");
  });
});
