import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { COUNTDOWN_MS } from "@/game/engine";
import type { GuessView } from "@/game/views";
import type { ClientAction, EnterResponse } from "@/server/contracts";
import { getDb, resetDbForTests } from "@/server/db";
import {
  act,
  authenticate,
  authenticatePair,
  bye,
  createRoom,
  history,
  joinRoom,
  peekRoom,
  pullStrokes,
  pushStrokes,
  recoverSeat,
  sync,
  type Auth,
} from "@/server/service";

const SARA = { name: "سارة", gender: "f", avatar: "cat", color: "violet", title: "ملكة التحديات" };
const MOSTAFA = { name: "مصطفى", gender: "m", avatar: "fox", color: "mint", title: "الكابتن" };

const header = (e: EnterResponse) => `Bearer ${e.creds.pid}.${e.creds.token}`;
const authOf = (e: EnterResponse) => authenticate(header(e));

/** Move the server clock without touching real timers (the database needs those). */
function advance(ms: number) {
  vi.setSystemTime(Date.now() + ms);
}

async function pair() {
  const a = await createRoom(SARA);
  const b = await joinRoom(a.creds.code, MOSTAFA);
  return { a, b, authA: await authOf(a), authB: await authOf(b) };
}

async function startGame(authA: Auth, authB: Auth, gameId: string) {
  await act(authA, { type: "propose", gameId });
  await act(authB, { type: "respond", accept: true });
  advance(COUNTDOWN_MS + 50);
  const res = await sync(authA, 0);
  expect(res.view?.session?.phase).toBe("play");
  return res.view!;
}

/**
 * By default the suite runs on the embedded database, in memory.
 * `DUWA_TEST_DATABASE_URL=postgres://… npm test` runs the very same tests through the
 * production driver against a real Postgres (use a scratch database: it leaves test rooms behind).
 */
const REAL_DB = process.env.DUWA_TEST_DATABASE_URL;

/** Let time pass up to just before `t` while both phones keep polling (a silent phone freezes the clock). */
async function idleUntil(authA: Auth, authB: Auth, t: number) {
  while (t - Date.now() > 4_000) {
    advance(4_000);
    await sync(authA, 0);
    await sync(authB, 0);
  }
}

beforeAll(() => {
  process.env.DUWA_DATA_DIR = "memory://";
  if (REAL_DB) process.env.DATABASE_URL = REAL_DB;
  else delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.setSystemTime(new Date());
});

afterAll(async () => {
  vi.useRealTimers();
  await resetDbForTests();
});

describe("private rooms", () => {
  it("creates a room with an invite code and a secret device token", async () => {
    const a = await createRoom(SARA);
    expect(a.creds.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(a.creds.recovery).toMatch(/^[A-Z2-9]{8}$/);
    expect(a.view.me).toMatchObject({ seat: 0, name: "سارة", gender: "f", points: 0, online: true });
    expect(a.view.partner).toBeNull();
    expect(a.view.unlocked).toEqual(["laugh", "know"]);
    // secrets are stored hashed
    const db = await getDb();
    const rows = await db.query<{ token_hash: string; recovery_hash: string }>(
      "select token_hash, recovery_hash from duwa.players where id = $1",
      [a.creds.pid],
    );
    expect(rows[0].token_hash).not.toContain(a.creds.token);
    expect(rows[0].recovery_hash).not.toContain(a.creds.recovery!);
  });

  it("rejects invalid profiles", async () => {
    await expect(createRoom({ ...SARA, name: " " })).rejects.toMatchObject({ status: 400, code: "profile_name" });
    await expect(createRoom({ ...SARA, gender: undefined })).rejects.toMatchObject({ code: "profile_gender" });
    await expect(createRoom({ ...SARA, avatar: "dragon" })).rejects.toMatchObject({ code: "profile_avatar" });
    await expect(createRoom({ ...SARA, color: "#fff" })).rejects.toMatchObject({ code: "profile_color" });
  });

  it("lets exactly one more player in — a third is always refused", async () => {
    const a = await createRoom(SARA);
    expect(await peekRoom(a.creds.code)).toMatchObject({ state: "open", host: { name: "سارة" } });
    expect(await peekRoom("ZZZZZZ")).toEqual({ state: "missing" });

    await expect(joinRoom(a.creds.code, { ...MOSTAFA, color: "violet" })).rejects.toMatchObject({ code: "color_taken" });
    const b = await joinRoom(a.creds.code.toLowerCase(), MOSTAFA);
    expect(b.view.me.seat).toBe(1);
    expect(b.view.partner?.name).toBe("سارة");

    expect(await peekRoom(a.creds.code)).toEqual({ state: "full" });
    await expect(joinRoom(a.creds.code, { ...MOSTAFA, name: "دخيل", color: "pink" })).rejects.toMatchObject({
      status: 409,
      code: "room_full",
    });
    // even several attempts at the same instant cannot squeeze in
    const rush = await Promise.allSettled(
      ["pink", "amber", "cyan"].map((color) => joinRoom(a.creds.code, { ...MOSTAFA, name: "دخيل", color })),
    );
    expect(rush.every((r) => r.status === "rejected")).toBe(true);
    const db = await getDb();
    const count = await db.query<{ n: number }>(
      "select count(*)::int as n from duwa.players p join duwa.rooms r on r.id = p.room_id where r.code = $1",
      [a.creds.code],
    );
    expect(count[0].n).toBe(2);
  });

  it("fills the single free seat only once under simultaneous joins", async () => {
    const a = await createRoom(SARA);
    const rush = await Promise.allSettled(
      ["mint", "pink", "amber", "cyan"].map((color) => joinRoom(a.creds.code, { ...MOSTAFA, color })),
    );
    expect(rush.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    // the others are told the room is full — not answered with a server error
    for (const r of rush) {
      if (r.status === "rejected") expect(r.reason).toMatchObject({ status: 409, code: "room_full" });
    }
  });

  it("knows a device by its token, not by the room code", async () => {
    const { a, b } = await pair();
    await expect(authenticate(null)).rejects.toMatchObject({ status: 401 });
    await expect(authenticate(`Bearer ${a.creds.pid}.${b.creds.token}`)).rejects.toMatchObject({ status: 401 });
    await expect(authenticate(`Bearer ${a.creds.code}.${a.creds.token}`)).rejects.toMatchObject({ status: 401 });
    await expect(authenticatePair(a.creds.pid, "x".repeat(43))).rejects.toMatchObject({ status: 401 });
    expect(await authOf(a)).toMatchObject({ seat: 0 });
  });
});

describe("sync", () => {
  it("returns the room at once when the client is behind, and wakes up on changes", async () => {
    const { authA, authB } = await pair();
    const first = await sync(authA, 0);
    expect(first.view?.partner).toMatchObject({ name: "مصطفى", online: true });

    // nothing new: the request waits… until the partner does something
    const started = performance.now();
    const waiting = sync(authA, first.v);
    await new Promise((r) => setTimeout(r, 150));
    await act(authB, { type: "propose", gameId: "guess" });
    const woke = await waiting;
    expect(performance.now() - started).toBeLessThan(3000);
    expect(woke.v).toBeGreaterThan(first.v);
    expect(woke.view?.session).toMatchObject({ phase: "invite", host: 1, gameId: "guess" });
  });

  // Only meaningful on a hosted database: there, the two phones can be served by different
  // server instances, and nothing in this process announces the other instance's changes.
  it.runIf(!!REAL_DB)("notices a change made by another server instance", async () => {
    const { a, authA } = await pair();
    const first = await sync(authA, 0);
    const started = performance.now();
    const waiting = sync(authA, first.v);
    await new Promise((r) => setTimeout(r, 150));
    const db = await getDb();
    await db.query("update duwa.rooms set version = version + 1 where code = $1", [a.creds.code]);
    const woke = await waiting;
    expect(performance.now() - started).toBeLessThan(2500);
    expect(woke.v).toBe(first.v + 1);
    expect(woke.view?.code).toBe(a.creds.code);
  });

  it("shows the partner as away right after they close the page", async () => {
    const { authA, authB } = await pair();
    await bye(authB);
    const res = await sync(authA, 0);
    expect(res.view?.partner?.online).toBe(false);
    const back = await sync(authB, 0);
    expect(back.view?.me.online).toBe(true);
    expect((await sync(authA, 0)).view?.partner?.online).toBe(true);
  });
});

describe("a full round, judged by the server", () => {
  it("syncs the same question to both phones, hides answers, and pays points exactly once", async () => {
    const { authA, authB } = await pair();
    const viewA = await startGame(authA, authB, "guess");
    const viewB = (await sync(authB, 0)).view!;
    const qA = viewA.session!.cur as GuessView;
    const qB = viewB.session!.cur as GuessView;
    expect(qA.text).toBe(qB.text);
    expect(qA.options).toEqual(qB.options);
    expect(viewA.session!.endsAt).toBe(viewB.session!.endsAt);

    let last = viewA;
    while (last.session!.phase !== "done") {
      const afterA = await act(authA, { type: "play", move: { t: "answer", mine: 1, guess: 2 } });
      // the partner cannot see the answer yet…
      const peek = (await sync(authB, 0)).view!;
      expect((peek.session!.cur as GuessView).mine).toBeNull();
      expect((peek.session!.cur as GuessView).partnerDone).toBe(true);
      expect(JSON.stringify(peek.session)).not.toContain('"mine":1,"guess":2');
      // …and sending again changes nothing
      await expect(act(authA, { type: "play", move: { t: "answer", mine: 3, guess: 3 } })).rejects.toMatchObject({
        status: 409,
        code: "already",
      });
      expect(afterA.view.session!.phase).toBe("play");

      const afterB = await act(authB, { type: "play", move: { t: "answer", mine: 2, guess: 0 } });
      expect(afterB.view.session!.phase).toBe("reveal");
      expect(afterB.view.session!.log.at(-1)).toMatchObject({ mine: [1, 2], guess: [2, 0], hit: [true, false] });
      await act(authA, { type: "next" });
      last = (await act(authB, { type: "next" })).view;
    }

    const result = last.session!.result!;
    expect(result.winner).toBe(0);
    expect(result.score).toEqual([5, 0]);

    // what the phones show equals what the database stored
    const db = await getDb();
    const ledger = await db.query<{ owner: number; points: number; key: string }>(
      "select owner, points, key from duwa.scores where session_id = $1",
      [result.sessionId],
    );
    const sum = (owner: number) => ledger.filter((l) => l.owner === owner).reduce((t, l) => t + Number(l.points), 0);
    expect(ledger).toHaveLength(result.awards.length);
    expect(sum(0)).toBe(result.earned[0]);
    expect(sum(1)).toBe(result.earned[1]);
    expect(sum(0) + sum(1) + sum(2)).toBe(result.sharedAfter - result.sharedBefore);

    const fresh = (await sync(authB, 0)).view!;
    expect(fresh.shared).toBe(result.sharedAfter);
    expect(fresh.partner!.points).toBe(result.earned[0]);
    expect(fresh.me.points).toBe(result.earned[1]);
    expect(fresh.last).toMatchObject({ gameId: "guess", winner: 0 });
    expect(fresh.achievements.map((a) => a.key)).toEqual(expect.arrayContaining(["first_step", "first_win", "mind_reader"]));

    // late or repeated requests after the round is over cannot add points
    await expect(act(authA, { type: "play", move: { t: "answer", mine: 1, guess: 1 } })).rejects.toMatchObject({ status: 409 });
    await act(authA, { type: "next" });
    expect((await sync(authA, 0)).view!.shared).toBe(result.sharedAfter);
    const again = await db.query<{ n: number }>("select count(*)::int as n from duwa.scores where session_id = $1", [
      result.sessionId,
    ]);
    expect(again[0].n).toBe(ledger.length);

    // the database itself refuses to record the same award twice
    await expect(
      db.query(
        "insert into duwa.scores (room_id, key, session_id, owner, reason, points, created_ms) select room_id, key, session_id, owner, reason, points, created_ms from duwa.scores where session_id = $1 limit 1",
        [result.sessionId],
      ),
    ).rejects.toThrow();

    const past = await history(authA);
    expect(past.items[0]).toMatchObject({ sessionId: result.sessionId, gameId: "guess", winner: 0 });
    expect(past.items[0]).not.toHaveProperty("log");
  });

  it("never loses a move when both phones act at the very same instant", async () => {
    // On a hosted database the two requests really do run side by side.
    const { authA, authB } = await pair();
    await startGame(authA, authB, "guess");
    for (let round = 0; round < 5; round++) {
      const answered = await Promise.all([
        act(authA, { type: "play", move: { t: "answer", mine: 0, guess: 1 } }),
        act(authB, { type: "play", move: { t: "answer", mine: 1, guess: 0 } }),
      ]);
      // whoever was second saw the other's answer and closed the question
      expect(answered.map((r) => r.view.session!.phase).sort()).toEqual(["play", "reveal"]);
      const reveal = (await sync(authA, 0)).view!.session!;
      expect(reveal).toMatchObject({ phase: "reveal", round });
      expect(reveal.log.at(-1)).toMatchObject({ mine: [0, 1], guess: [1, 0], hit: [true, true] });

      await Promise.all([act(authA, { type: "next" }), act(authB, { type: "next" })]);
      const after = (await sync(authB, 0)).view!.session!;
      if (round < 4) expect(after).toMatchObject({ phase: "play", round: round + 1 });
      else expect(after.phase).toBe("done");
    }
    const view = (await sync(authA, 0)).view!;
    const result = view.session!.result!;
    expect(result.score).toEqual([5, 5]);
    const db = await getDb();
    const ledger = await db.query<{ points: number }>("select points from duwa.scores where session_id = $1", [
      result.sessionId,
    ]);
    expect(ledger).toHaveLength(result.awards.length);
    expect(ledger.reduce((t, l) => t + Number(l.points), 0)).toBe(result.sharedAfter - result.sharedBefore);
    expect(view.shared).toBe(result.sharedAfter);
  });

  it("lets a deadline run out only once, however many requests notice it", async () => {
    const { authA, authB } = await pair();
    await startGame(authA, authB, "guess");
    for (let round = 0; round < 5; round++) {
      const before = (await sync(authA, 0)).view!;
      expect(before.session).toMatchObject({ phase: "play", round });
      // nobody answers; both phones (and their polls) notice the timeout together
      await idleUntil(authA, authB, before.session!.endsAt!);
      advance(before.session!.endsAt! - Date.now() + 20);
      const seen = await Promise.all([sync(authA, 0), sync(authB, 0), sync(authA, 0), sync(authB, 0)]);
      for (const r of seen) expect(r.view!.session).toMatchObject({ phase: "reveal", round });
      expect(new Set(seen.map((r) => r.v)).size).toBe(1);

      const revealEnds = seen[0].view!.session!.endsAt!;
      await idleUntil(authA, authB, revealEnds);
      advance(revealEnds - Date.now() + 20);
      const moved = await Promise.all([sync(authA, 0), sync(authB, 0), sync(authA, 0), sync(authB, 0)]);
      expect(new Set(moved.map((r) => r.v)).size).toBe(1);
      for (const r of moved) {
        if (round < 4) expect(r.view!.session).toMatchObject({ phase: "play", round: round + 1 });
        else expect(r.view!.session!.phase).toBe("done");
      }
    }
    const view = (await sync(authA, 0)).view!;
    const result = view.session!.result!;
    expect(result.score).toEqual([0, 0]);
    const db = await getDb();
    const ledger = await db.query<{ n: number }>("select count(*)::int as n from duwa.scores where session_id = $1", [
      result.sessionId,
    ]);
    expect(ledger[0].n).toBe(result.awards.length);
  });

  it("keeps the round when a player drops, and resumes it when they return", async () => {
    const { authA, authB } = await pair();
    const view = await startGame(authA, authB, "guess");
    const question = (view.session!.cur as GuessView).text;
    await act(authA, { type: "play", move: { t: "answer", mine: 0, guess: 0 } });

    await bye(authB); // connection lost
    const paused = (await sync(authA, 0)).view!;
    expect(paused.session).toMatchObject({ phase: "play", round: 0, pause: { seat: 1 }, endsAt: null });

    advance(30 * 60_000); // half an hour later nothing was lost or timed out
    expect((await sync(authA, 0)).view!.session).toMatchObject({ phase: "play", round: 0, pause: { seat: 1 } });

    const back = (await sync(authB, 0)).view!; // B reconnects
    expect(back.session).toMatchObject({ phase: "play", round: 0, pause: null });
    expect((back.session!.cur as GuessView).text).toBe(question);
    expect(back.session!.endsAt).toBeGreaterThan(Date.now());
    const done = await act(authB, { type: "play", move: { t: "answer", mine: 0, guess: 0 } });
    expect(done.view.session!.phase).toBe("reveal");
    expect(done.view.session!.score).toEqual([1, 1]);
  });

  it("refuses locked games and unknown actions", async () => {
    const { authA } = await pair();
    await expect(act(authA, { type: "propose", gameId: "word" })).rejects.toMatchObject({ status: 409, code: "locked" });
    await expect(act(authA, { type: "propose", gameId: "four" })).rejects.toMatchObject({ code: "soon" });
    await expect(act(authA, { type: "hack" } as unknown as ClientAction)).rejects.toMatchObject({ status: 400 });
    await expect(act(authA, { type: "play", move: { t: "answer" } })).rejects.toMatchObject({ status: 409 });
  });
});

describe("drawing strokes", () => {
  it("accepts strokes only from the current artist and streams them to the guesser", async () => {
    const { authA, authB } = await pair();
    const view = await startGame(authA, authB, "draw");
    const sid = view.session!.id;
    const stroke = [{ k: "s", id: 1, c: 0, w: 6, p: [10, 10, 500, 520] }];

    // still choosing a word: nobody can draw yet
    await expect(pushStrokes(authA, sid, 0, stroke)).rejects.toMatchObject({ code: "not_drawing" });
    await act(authA, { type: "play", move: { t: "choose", i: 0 } });

    await expect(pushStrokes(authB, sid, 0, stroke)).rejects.toMatchObject({ code: "not_drawing" });
    await expect(pushStrokes(authA, sid, 0, [{ k: "s", id: 1, c: 0, w: 6, p: [1] }])).rejects.toMatchObject({ status: 400 });
    await pushStrokes(authA, sid, 0, stroke);
    await pushStrokes(authA, sid, 0, [{ k: "u" }]);

    const got = await pullStrokes(authB, sid, 0, 0);
    expect(got.batches.map((b) => b.seq)).toEqual([1, 2]);
    expect(got.batches[0].ops).toEqual([{ k: "s", id: 1, c: 0, w: 6, p: [10, 10, 500, 520] }]);
    expect((await pullStrokes(authB, sid, 0, 1)).batches.map((b) => b.seq)).toEqual([2]);

    // a player from another room gets nothing
    const stranger = await authOf(await createRoom({ ...SARA, name: "غريب" }));
    const ac = new AbortController();
    const nothing = pullStrokes(stranger, sid, 0, 0, ac.signal);
    ac.abort();
    expect((await nothing).batches).toEqual([]);
  });
});

describe("recovery and leaving", () => {
  it("restores a seat on a new device and signs the old device out", async () => {
    const { a, authB } = await pair();
    await expect(recoverSeat(a.creds.code, "AAAAAAAA")).rejects.toMatchObject({ status: 401, code: "bad_recovery" });
    const again = await recoverSeat(a.creds.code, a.creds.recovery!.toLowerCase());
    expect(again.view.me).toMatchObject({ seat: 0, name: "سارة" });
    expect(again.creds.token).not.toBe(a.creds.token);
    await expect(authOf(a)).rejects.toMatchObject({ status: 401 });
    expect(await authOf(again)).toMatchObject({ seat: 0 });

    // a new recovery code replaces the old one
    const fresh = await act(await authOf(again), { type: "new_recovery" });
    expect(fresh.recovery).toMatch(/^[A-Z2-9]{8}$/);
    await expect(recoverSeat(a.creds.code, a.creds.recovery!)).rejects.toMatchObject({ code: "bad_recovery" });
    expect((await recoverSeat(a.creds.code, fresh.recovery!)).view.me.seat).toBe(0);
    expect(authB.seat).toBe(1);
  });

  it("locks recovery after repeated wrong codes", async () => {
    const { a } = await pair();
    for (let i = 0; i < 8; i++) {
      await expect(recoverSeat(a.creds.code, "BBBBBBBB")).rejects.toMatchObject({ code: "bad_recovery" });
    }
    await expect(recoverSeat(a.creds.code, a.creds.recovery!)).rejects.toMatchObject({ status: 429, code: "recovery_locked" });
    advance(16 * 60_000);
    expect((await recoverSeat(a.creds.code, a.creds.recovery!)).view.me.seat).toBe(0);
  });

  it("deleting an account frees the seat behind a brand-new invite code", async () => {
    const { a, authA, authB } = await pair();
    const gone = await act(authB, { type: "delete_me" });
    expect(gone.gone).toBe(true);
    await expect(sync(authB, 0)).rejects.toMatchObject({ status: 401 });

    const view = (await sync(authA, 0)).view!;
    expect(view.partner).toBeNull();
    expect(view.code).not.toBe(a.creds.code);
    expect(view.flash).toMatchObject({ kind: "left", by: 1 });
    await expect(joinRoom(a.creds.code, MOSTAFA)).rejects.toMatchObject({ code: "no_room" });
    expect((await joinRoom(view.code, MOSTAFA)).view.me.seat).toBe(1);
  });

  it("removes the whole room when the last player leaves", async () => {
    const a = await createRoom(SARA);
    const authA = await authOf(a);
    await act(authA, { type: "delete_me" });
    expect(await peekRoom(a.creds.code)).toEqual({ state: "missing" });
    const db = await getDb();
    const left = await db.query<{ n: number }>("select count(*)::int as n from duwa.players where id = $1", [a.creds.pid]);
    expect(left[0].n).toBe(0);
  });

  it("updates the profile but never to the partner's colour", async () => {
    const { authA } = await pair();
    await expect(act(authA, { type: "profile", profile: { ...SARA, color: "mint" } })).rejects.toMatchObject({ code: "color_taken" });
    const res = await act(authA, { type: "profile", profile: { ...SARA, name: "  سوسو  ", avatar: "moon", color: "pink" } });
    expect(res.view.me).toMatchObject({ name: "سوسو", avatar: "moon", color: "pink" });
  });

  it("can replace the invite code", async () => {
    const a = await createRoom(SARA);
    const res = await act(await authOf(a), { type: "rotate_code" });
    expect(res.view.code).not.toBe(a.creds.code);
    expect(await peekRoom(a.creds.code)).toEqual({ state: "missing" });
    expect(await peekRoom(res.view.code)).toMatchObject({ state: "open" });
  });
});

describe("durability", () => {
  it("keeps rooms, points and running rounds across a server restart", async () => {
    await resetDbForTests();
    const dir = mkdtempSync(path.join(tmpdir(), "duwa-test-"));
    process.env.DUWA_DATA_DIR = path.join(dir, "pg");
    try {
      const { a, b, authA, authB } = await pair();
      await startGame(authA, authB, "guess");
      await act(authA, { type: "play", move: { t: "answer", mine: 3, guess: 3 } });

      await resetDbForTests(); // "the app was closed"

      const authA2 = await authOf(a);
      const view = (await sync(authA2, 0)).view!;
      expect(view.code).toBe(a.creds.code);
      expect(view.session).toMatchObject({ phase: "play", round: 0 });
      expect((view.session!.cur as GuessView).mine).toEqual({ mine: 3, guess: 3 });
      expect(view.partner?.name).toBe("مصطفى");
      expect((await authOf(b)).seat).toBe(1);
    } finally {
      await resetDbForTests();
      process.env.DUWA_DATA_DIR = "memory://";
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
