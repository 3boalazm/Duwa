import { clientIp, fail, ok, rateLimit, readJson } from "@/server/http";
import { recoverSeat } from "@/server/service";

/** Return to your own seat from another device with your recovery code. */
export async function POST(req: Request) {
  try {
    rateLimit("recover", clientIp(req), 12, 10 * 60_000);
    const body = await readJson(req);
    return ok(await recoverSeat(body.code, body.recovery));
  } catch (err) {
    return fail(err);
  }
}
