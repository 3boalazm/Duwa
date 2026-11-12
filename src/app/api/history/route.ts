import { fail, ok } from "@/server/http";
import { authenticate, history } from "@/server/service";

/** Finished rounds of this room, newest first. */
export async function GET(req: Request) {
  try {
    const auth = await authenticate(req.headers.get("authorization"));
    return ok(await history(auth));
  } catch (err) {
    return fail(err);
  }
}
