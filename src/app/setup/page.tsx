"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { api, errorMessage } from "@/client/api";
import { useClientValue } from "@/client/hooks";
import { loadCreds, saveCreds, tidyCode } from "@/client/session";
import { Avatar } from "@/components/Avatar";
import { EMPTY_PROFILE, ProfileForm, type ProfileDraft } from "@/components/ProfileForm";
import { Button, Notice, Screen } from "@/components/ui";
import { COLORS, parseProfile, PROFILE_ERRORS } from "@/game/profile";
import type { EnterResponse, PeekResult } from "@/server/contracts";

/** Screen 02 — create your character, then create or join the room. */
export default function SetupPage() {
  const router = useRouter();
  // "/setup?mode=join&code=ABC234" joins that room; anything else creates a new one.
  const entry = useClientValue(() => {
    const q = new URLSearchParams(window.location.search);
    const invite = tidyCode(q.get("code") ?? "");
    return q.get("mode") === "join" && invite.length === 6 ? `join:${invite}` : "create";
  }, "");
  const mode = entry === "" ? null : entry === "create" ? "create" : "join";
  const code = mode === "join" ? entry.slice(5) : "";
  const [host, setHost] = useState<PeekResult["host"]>();
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_PROFILE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mode) return;
    if (loadCreds()) {
      router.replace("/home");
      return;
    }
    if (mode !== "join") return;
    let alive = true;
    api<PeekResult>(`/api/rooms/peek?code=${code}`)
      .then((peek) => {
        if (!alive) return;
        if (peek.state !== "open") {
          router.replace(`/?code=${code}`);
          return;
        }
        setHost(peek.host);
        // start on a colour the host is not using
        const free = COLORS.find((c) => c.id !== peek.host?.color);
        if (peek.host && free) setDraft((d) => (d.color === peek.host?.color ? { ...d, color: free.id } : d));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [mode, code, router]);

  async function submit() {
    const parsed = parseProfile(draft);
    if (!parsed.ok) {
      setError(PROFILE_ERRORS[parsed.error]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "join"
          ? await api<EnterResponse>("/api/rooms/join", { method: "POST", body: { code, profile: parsed.profile } })
          : await api<EnterResponse>("/api/rooms", { method: "POST", body: { profile: parsed.profile } });
      saveCreds(res.creds);
      router.replace(mode === "join" ? "/home" : "/lobby");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!mode) return <Screen />;

  return (
    <Screen className="pb-32 pt-5">
      <header className="mb-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="رجوع"
          className="grid size-10 place-items-center rounded-full text-mist transition-colors hover:bg-white/5 hover:text-cloud"
        >
          <ChevronRight className="size-6" />
        </button>
        <div>
          <h1 className="text-[22px] font-bold">شخصيتك في دُوّا</h1>
          <p className="text-[13px] text-mist">
            {mode === "join" ? "آخر خطوة قبل ما تدخل الغرفة." : "اختار شكلك، وبعدها هنجهّز غرفتكم."}
          </p>
        </div>
      </header>

      {mode === "join" && host && (
        <div className="card mb-5 flex items-center gap-3 p-3 animate-rise">
          <Avatar avatar={host.avatar} color={host.color} size={44} />
          <p className="text-[14px] text-mist">
            هتنضم لغرفة <b className="font-semibold text-cloud">{host.name}</b> — {host.title}
          </p>
        </div>
      )}

      <div className="animate-rise">
        <ProfileForm value={draft} onChange={setDraft} takenColor={host?.color} takenBy={host?.name} />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[460px] bg-[linear-gradient(180deg,transparent,#090b18_38%)] px-5 pt-8 safe-b">
        {error && (
          <Notice tone="rose" className="mb-3 animate-shake">
            {error}
          </Notice>
        )}
        <Button block loading={busy} onClick={submit}>
          {mode === "join" ? "دخول الغرفة" : "إنشاء الغرفة"}
        </Button>
      </div>
    </Screen>
  );
}
