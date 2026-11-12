import { fail, readJson } from "@/server/http";
import { authenticatePair, bye } from "@/server/service";

/**
 * Sent with navigator.sendBeacon when the page closes, so the partner sees
 * "away" immediately. Beacons cannot set headers, so the identity is in the body.
 */
export async function POST(req: Request) {
  try {
    const body = await readJson(req, 2_000);
    const auth = await authenticatePair(String(body.pid ?? ""), String(body.token ?? ""));
    await bye(auth);
    return new Response(null, { status: 204 });
  } catch (err) {
    return fail(err);
  }
}
