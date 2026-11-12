import type { ClientAction } from "@/server/contracts";
import { ApiFail, fail, ok, readJson } from "@/server/http";
import { act, authenticate } from "@/server/service";

/** Every player move goes through here and is judged on the server. */
export async function POST(req: Request) {
  try {
    const auth = await authenticate(req.headers.get("authorization"));
    const body = await readJson(req);
    if (typeof body.type !== "string") throw new ApiFail(400, "bad_action", "الحركة دي مش مفهومة.");
    return ok(await act(auth, body as unknown as ClientAction));
  } catch (err) {
    return fail(err);
  }
}
