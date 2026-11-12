/**
 * In-process notifier used by long-polling requests.
 * A mutation calls `notify(channel)`; requests waiting on that channel wake up
 * immediately instead of polling. (Across several server instances the
 * waiters also re-check the database on a short interval.)
 */
type Waiter = () => void;

const store = globalThis as unknown as { __duwaHub?: Map<string, Set<Waiter>> };
const channels = (store.__duwaHub ??= new Map<string, Set<Waiter>>());

export function notify(channel: string): void {
  const waiters = channels.get(channel);
  if (!waiters) return;
  channels.delete(channel);
  for (const wake of waiters) wake();
}

/** Resolves on notify, after `ms`, or when the request is aborted. */
export function wait(channel: string, ms: number, signal?: AbortSignal): Promise<"notified" | "timeout" | "aborted"> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve("aborted");
    let set = channels.get(channel);
    if (!set) channels.set(channel, (set = new Set()));
    const done = (why: "notified" | "timeout" | "aborted") => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      const current = channels.get(channel);
      if (current) {
        current.delete(wake);
        if (current.size === 0) channels.delete(channel);
      }
      resolve(why);
    };
    const wake: Waiter = () => done("notified");
    const onAbort = () => done("aborted");
    const timer = setTimeout(() => done("timeout"), Math.max(0, ms));
    signal?.addEventListener("abort", onAbort, { once: true });
    set.add(wake);
  });
}
