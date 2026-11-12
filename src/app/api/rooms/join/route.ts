import { clientIp, fail, ok, rateLimit, readJson } from "@/server/http";
import { joinRoom } from "@/server/service";

/** Take the second seat of a room with its invite code. */
export async function POST(req: Request) {
  try {
    rateLimit("join", clientIp(req), 30, 10 * 60_000);
    const body = await readJson(req);
    return ok(await joinRoom(body.code, body.profile), 201);
  } catch (err) {
    return fail(err);
  }
}
