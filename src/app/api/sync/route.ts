import { fail, ok } from "@/server/http";
import { authenticate, sync } from "@/server/service";

// The request is held open for a few seconds waiting for news (long-poll).
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const auth = await authenticate(req.headers.get("authorization"));
    const v = Number(new URL(req.url).searchParams.get("v") ?? 0);
    return ok(await sync(auth, Number.isFinite(v) ? v : 0, req.signal));
  } catch (err) {
    return fail(err);
  }
}
