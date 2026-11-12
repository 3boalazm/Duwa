"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, KeyRound } from "lucide-react";
import { api, errorMessage } from "@/client/api";
import { CODE_LENGTH, loadCreds, prettyRecovery, saveCreds, tidyCode, tidyRecovery } from "@/client/session";
import { Button, Notice, Screen, TextField } from "@/components/ui";
import type { EnterResponse } from "@/server/contracts";

/** Return to your own seat from a new phone or browser. */
export default function RecoverPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loadCreds()) router.replace("/home");
  }, [router]);

  const ready = code.length === CODE_LENGTH && recovery.length === 8;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<EnterResponse>("/api/rooms/recover", { method: "POST", body: { code, recovery } });
      saveCreds(res.creds);
      router.replace("/home");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Screen className="pb-10 pt-5">
      <header className="mb-8 flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="رجوع"
          className="grid size-10 place-items-center rounded-full text-mist transition-colors hover:bg-white/5 hover:text-cloud"
        >
          <ChevronRight className="size-6" />
        </button>
        <h1 className="text-[22px] font-bold">الرجوع لغرفتك</h1>
      </header>

      <div className="animate-rise">
        <span className="mb-5 grid size-16 place-items-center rounded-2xl bg-violet/20 text-lavender shadow-[inset_0_0_0_1px_rgb(129_85_239/0.5)]">
          <KeyRound className="size-8" />
        </span>
        <p className="text-[15px] leading-7 text-mist">
          غيّرت الموبايل أو مسحت المتصفح؟ اكتب كود الغرفة وكود الاستعادة الخاص بيك، وهترجع لنفس مكانك بنقاطك وإنجازاتك.
        </p>

        <form
          className="mt-7 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <label htmlFor="rc-code" className="mb-2 block text-[14px] font-semibold text-mist">
              كود الغرفة
            </label>
            <TextField
              id="rc-code"
              dir="ltr"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => {
                setCode(tidyCode(e.target.value));
                setError(null);
              }}
              placeholder="ABC234"
              className="text-center font-latin text-[20px] font-bold tracking-[0.36em] placeholder:font-normal placeholder:text-dim/50"
            />
          </div>
          <div>
            <label htmlFor="rc-rec" className="mb-2 block text-[14px] font-semibold text-mist">
              كود الاستعادة
            </label>
            <TextField
              id="rc-rec"
              dir="ltr"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={prettyRecovery(recovery)}
              onChange={(e) => {
                setRecovery(tidyRecovery(e.target.value));
                setError(null);
              }}
              placeholder="ABCD-2345"
              className="text-center font-latin text-[20px] font-bold tracking-[0.24em] placeholder:font-normal placeholder:text-dim/50"
            />
          </div>
          {error && (
            <Notice tone="rose" className="animate-shake">
              {error}
            </Notice>
          )}
          <Button type="submit" block loading={busy} disabled={!ready}>
            رجّعني لغرفتي
          </Button>
        </form>

        <p className="mt-6 text-[13px] leading-6 text-dim">
          كود الاستعادة ظهر لك أول ما دخلت الغرفة، وموجود في الإعدادات على جهازك القديم. الدخول من هنا بيسجّل خروج الجهاز القديم.
        </p>
      </div>
    </Screen>
  );
}
