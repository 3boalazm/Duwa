import { clientIp, fail, ok, rateLimit } from "@/server/http";
import { peekRoom } from "@/server/service";

/** Is there a room with this invite code, and does it still have a free seat? */
export async function GET(req: Request) {
  try {
    rateLimit("peek", clientIp(req), 40, 10 * 60_000);
    const code = new URL(req.url).searchParams.get("code");
    return ok(await peekRoom(code));
  } catch (err) {
    return fail(err);
  }
}
