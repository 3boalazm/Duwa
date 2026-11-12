"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Settings, ShieldCheck } from "lucide-react";
import { useRoom, useRoomView } from "@/client/room";
import { prettyRecovery } from "@/client/session";
import { copyText } from "@/client/share";
import { Avatar } from "@/components/Avatar";
import { BrandRow } from "@/components/Logo";
import { InviteCard } from "@/components/room/InviteCard";
import { Button, Dots, Screen } from "@/components/ui";
import { gx } from "@/game/profile";


/** Screen 03 — the private room: invite the second player and watch them connect. */
export default function LobbyPage() {
  const view = useRoomView();
  const { creds } = useRoom();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const partner = view.partner;

  // Both seats are taken: celebrate for a moment, then move on.
  useEffect(() => {
    if (!partner) return;
    const t = setTimeout(() => router.replace("/home"), 2600);
    return () => clearTimeout(t);
  }, [partner, router]);

  return (
    <Screen className="pb-10 pt-5">
      <header className="flex items-center justify-between">
        <BrandRow />
        <Link
          href="/settings"
          aria-label="الإعدادات"
          className="grid size-10 place-items-center rounded-full text-mist transition-colors hover:bg-white/5 hover:text-cloud"
        >
          <Settings className="size-5" />
        </Link>
      </header>

      <div className="mt-7 text-center animate-rise">
        <h1 className="text-[26px] font-bold">{partner ? "اتصلتوا!" : "غرفتكم جاهزة"}</h1>
        <p className="mt-1.5 text-[15px] text-mist">
          {partner ? "العالم بقى بتاعكم إنتوا الاتنين وبس." : `${gx(view.me, "ابعت", "ابعتي")} الكود للاعب التاني عشان يدخل.`}
        </p>
      </div>

      {/* the two seats */}
      <div className="mt-8 flex items-center justify-center gap-3 animate-rise [animation-delay:80ms]">
        <Seat name={view.me.name} caption="إنت">
          <Avatar avatar={view.me.avatar} color={view.me.color} size={84} online glow />
        </Seat>
        <div className="mb-9 flex w-16 items-center" aria-hidden>
          <span
            className={`h-0.5 w-full rounded-full transition-all duration-700 ${
              partner ? "bg-[linear-gradient(90deg,#b19aff,#8155ef)] shadow-[0_0_14px_rgb(129_85_239/0.9)]" : "bg-[repeating-linear-gradient(90deg,rgb(177_154_255/0.4)_0_6px,transparent_6px_12px)]"
            }`}
          />
        </div>
        {partner ? (
          <Seat name={partner.name} caption={partner.title}>
            <Avatar avatar={partner.avatar} color={partner.color} size={84} online={partner.online} glow className="animate-pop" />
          </Seat>
        ) : (
          <Seat name="مستنيين…" caption="اللاعب التاني" muted>
            <span className="grid size-[84px] place-items-center rounded-full border-2 border-dashed border-line-2 text-lavender animate-breathe">
              <Dots />
            </span>
          </Seat>
        )}
      </div>

      {partner ? (
        <Button block className="mt-9 animate-rise" onClick={() => router.replace("/home")}>
          يلا على الرئيسية
        </Button>
      ) : (
        <>
          <InviteCard code={view.code} className="mt-8 animate-rise [animation-delay:140ms]" />

          <p className="mt-4 flex items-start gap-2 text-[13px] leading-6 text-mist animate-rise [animation-delay:180ms]">
            <ShieldCheck className="mt-1 size-4 shrink-0 text-mint" />
            الغرفة دي بتشيل لاعبين بس. أول ما اللاعب التاني يدخل، محدش تالت يقدر يدخلها بالكود.
          </p>

          {creds?.recovery && (
            <div className="card mt-6 p-4 animate-rise [animation-delay:220ms]">
              <div className="flex items-center gap-2 text-[14px] font-semibold">
                <KeyRound className="size-4 text-amber" />
                كود الاستعادة بتاعك
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span dir="ltr" className="font-latin text-[19px] font-bold tracking-[0.14em] text-cloud">
                  {prettyRecovery(creds.recovery)}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if (await copyText(creds.recovery ?? "")) {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-[13px] text-lavender transition-colors hover:bg-violet/30"
                >
                  {copied ? <Check className="size-4 text-mint" /> : <Copy className="size-4" />}
                  {copied ? "اتنسخ" : "نسخ"}
                </button>
              </div>
              <p className="mt-2 text-[12px] leading-5 text-dim">
                {gx(view.me, "احتفظ بيه لنفسك. لو غيّرت موبايلك", "احتفظي بيه لنفسك. لو غيّرتي موبايلك")}، هو اللي بيرجّعك لمكانك ونقاطك. موجود دايمًا في الإعدادات.
              </p>
            </div>
          )}

          <p className="mt-6 text-center text-[12px] leading-5 text-dim">
            {gx(view.me, "عايز تجرّب لوحدك؟ افتح الرابط من موبايل تاني أو من نافذة خفية وادخل بالكود.", "عايزة تجرّبي لوحدك؟ افتحي الرابط من موبايل تاني أو من نافذة خفية وادخلي بالكود.")}
          </p>
        </>
      )}
    </Screen>
  );
}

function Seat({ name, caption, muted, children }: { name: string; caption: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex w-28 flex-col items-center text-center">
      {children}
      <p className={`mt-2.5 w-full truncate text-[15px] font-semibold ${muted ? "text-mist" : "text-cloud"}`}>{name}</p>
      <p className="w-full truncate text-[12px] text-dim">{caption}</p>
    </div>
  );
}
