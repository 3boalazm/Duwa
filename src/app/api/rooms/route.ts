import { clientIp, fail, ok, rateLimit, readJson } from "@/server/http";
import { createRoom } from "@/server/service";

/** Create a private room; the caller takes the first of its two seats. */
export async function POST(req: Request) {
  try {
    rateLimit("create", clientIp(req), 12, 10 * 60_000);
    const body = await readJson(req);
    return ok(await createRoom(body.profile), 201);
  } catch (err) {
    return fail(err);
  }
}
