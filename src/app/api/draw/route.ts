import { ApiFail, fail, ok, readJson } from "@/server/http";
import { authenticate, pullStrokes, pushStrokes } from "@/server/service";

export const maxDuration = 30;

/** The guesser follows the drawing: returns stroke batches after `after`. */
export async function GET(req: Request) {
  try {
    const auth = await authenticate(req.headers.get("authorization"));
    const q = new URL(req.url).searchParams;
    const sid = q.get("sid") ?? "";
    const turn = Number(q.get("turn"));
    const after = Number(q.get("after") ?? 0);
    if (!sid || !Number.isInteger(turn) || !Number.isInteger(after)) {
      throw new ApiFail(400, "bad_request", "الطلب مش مفهوم.");
    }
    return ok(await pullStrokes(auth, sid, turn, after, req.signal, q.get("wait") !== "0"));
  } catch (err) {
    return fail(err);
  }
}

/** The artist sends strokes in small batches. */
export async function POST(req: Request) {
  try {
    const auth = await authenticate(req.headers.get("authorization"));
    const body = await readJson(req, 200_000);
    await pushStrokes(auth, body.sid, body.turn, body.ops);
    return new Response(null, { status: 204 });
  } catch (err) {
    return fail(err);
  }
}
