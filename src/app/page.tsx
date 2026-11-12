"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { LogoHero, Wordmark } from "@/components/Logo";
import { Button, Notice, Screen, TextField } from "@/components/ui";
import { api, errorMessage } from "@/client/api";
import { useClientValue } from "@/client/hooks";
import { CODE_LENGTH, loadCreds, tidyCode } from "@/client/session";
import type { PeekResult } from "@/server/contracts";

/** Screen 01 — entry: create a private room or join with an invite code. */
export default function WelcomePage() {
  const router = useRouter();
  // "unknown" on the server: a returning device must not flash the welcome screen.
  const session = useClientValue(() => (loadCreds() ? "in" : "out"), "unknown");
  // An invite link (/?code=ABC234) fills the code in.
  const invite = useClientValue(() => tidyCode(new URLSearchParams(window.location.search).get("code") ?? ""), "");
  const [typed, setTyped] = useState<string | null>(null);
  const code = typed ?? invite;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Returning device → straight back into its room.
    if (session === "in") router.replace("/home");
  }, [session, router]);

  async function join() {
    if (code.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      const peek = await api<PeekResult>(`/api/rooms/peek?code=${code}`);
      if (peek.state === "missing") setError("مفيش غرفة بالكود ده. راجع الكود وجرّب تاني.");
      else if (peek.state === "full") setError("الغرفة دي مكتملة بلاعبين. لو إنت واحد منهم، ارجع بكود الاستعادة.");
      else router.push(`/setup?mode=join&code=${code}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (session !== "out") {
    return (
      <Screen className="items-center justify-center">
        <LogoHero size={96} />
      </Screen>
    );
  }

  return (
    <Screen className="pb-8 pt-10">
      <header className="flex flex-1 flex-col items-center justify-center text-center animate-rise">
        <LogoHero size={118} />
        <Wordmark className="mt-1" />
        <p dir="ltr" className="mt-4 whitespace-nowrap font-latin text-[9.5px] font-medium tracking-[0.26em] text-lavender">
          TWO PLAYERS. ONE PRIVATE UNIVERSE.
        </p>
        <h1 className="mt-7 text-[26px] font-bold text-cloud">عالم صغير، لشخصين فقط</h1>
        <p className="mt-2 text-[15px] text-mist">ابدأ غرفة جديدة أو انضم لصاحبك بكود الدعوة.</p>
      </header>

      <section className="mt-8 animate-rise [animation-delay:120ms]">
        <Button block onClick={() => router.push("/setup?mode=create")}>
          <Plus className="size-5" strokeWidth={2.6} />
          إنشاء غرفة جديدة
        </Button>

        <div className="my-6 flex items-center gap-3 text-[13px] text-mist">
          <span className="h-px flex-1 bg-line-2" />
          عندك كود دعوة؟
          <span className="h-px flex-1 bg-line-2" />
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <TextField
            dir="ltr"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-label="كود الغرفة"
            placeholder="ادخل كود الغرفة"
            value={code}
            maxLength={CODE_LENGTH + 2}
            onChange={(e) => {
              setTyped(tidyCode(e.target.value));
              setError(null);
            }}
            className={
              code
                ? "text-center font-latin text-[22px] font-bold tracking-[0.42em] ps-[0.42em]"
                : "text-center placeholder:tracking-normal"
            }
          />
          {error && (
            <Notice tone="rose" className="animate-shake">
              {error}
            </Notice>
          )}
          <Button type="submit" variant="soft" block loading={busy} disabled={code.length !== CODE_LENGTH}>
            انضم للغرفة
          </Button>
        </form>

        <button
          type="button"
          onClick={() => router.push("/recover")}
          className="mx-auto mt-6 block text-[13px] text-mist underline decoration-line-2 underline-offset-4 transition-colors hover:text-lavender"
        >
          راجع من جهاز جديد؟ ادخل بكود الاستعادة
        </button>
      </section>
    </Screen>
  );
}
