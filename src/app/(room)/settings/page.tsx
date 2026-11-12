"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Copy,
  History,
  KeyRound,
  LogOut,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  VolumeX,
} from "lucide-react";
import { api, ApiError, errorMessage } from "@/client/api";
import { useRoom, useRoomView } from "@/client/room";
import { prettyRecovery } from "@/client/session";
import { copyText, relativeTime } from "@/client/share";
import { Avatar } from "@/components/Avatar";
import { ProfileForm, type ProfileDraft } from "@/components/ProfileForm";
import { outcomeLine, PageHeader } from "@/components/room/bits";
import { GAME_ICON } from "@/components/room/icons";
import { InviteCard } from "@/components/room/InviteCard";
import { Sheet } from "@/components/room/Sheet";
import { Button, Notice, Screen, SectionTitle } from "@/components/ui";
import { GAMES } from "@/game/catalog";
import { type AvatarId, type ColorId, parseProfile, PROFILE_ERRORS } from "@/game/profile";
import type { HistoryResponse } from "@/server/contracts";

type Confirm = "rotate" | "recovery" | "signout" | "delete" | null;

/** Screen 10 — profile, calm mode, play history, room management, privacy, account. */
export default function SettingsPage() {
  const view = useRoomView();
  const { creds, act, toast, signOut, updateCreds, now } = useRoom();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(() => toDraft(view.me));
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // This screen only renders in the browser (after the room has loaded).
  const [calm, setCalm] = useState(() => typeof document !== "undefined" && document.documentElement.dataset.motion === "off");
  const [copied, setCopied] = useState(false);
  const [items, setItems] = useState<HistoryResponse["items"] | null>(null);

  useEffect(() => {
    if (!creds) return;
    let alive = true;
    api<HistoryResponse>("/api/history", { creds })
      .then((res) => alive && setItems(res.items))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
    // reload the list whenever a new round has been finished
  }, [creds, view.sessions]);

  const toggleCalm = () => {
    const next = !calm;
    setCalm(next);
    if (next) document.documentElement.dataset.motion = "off";
    else delete document.documentElement.dataset.motion;
    try {
      localStorage.setItem("duwa:motion", next ? "off" : "on");
    } catch {
      /* preference lives for this visit only */
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = () =>
    run(async () => {
      const parsed = parseProfile(draft);
      if (!parsed.ok) throw new ApiError(400, "profile", PROFILE_ERRORS[parsed.error]);
      await act({ type: "profile", profile: parsed.profile });
      setEditing(false);
      toast("اتحفظ الملف الشخصي", "good");
    });

  const confirmAction = () =>
    run(async () => {
      if (confirm === "rotate") {
        await act({ type: "rotate_code" });
        toast("كود الدعوة اتغيّر", "good");
      } else if (confirm === "recovery") {
        const res = await act({ type: "new_recovery" });
        if (res.recovery) updateCreds({ recovery: res.recovery });
        toast("كود الاستعادة الجديد جاهز", "good");
      } else if (confirm === "signout") {
        signOut();
      } else if (confirm === "delete") {
        await act({ type: "delete_me" });
        signOut();
      }
      setConfirm(null);
    });

  const partner = view.partner;

  return (
    <Screen className="pb-28 pt-6">
      {!partner && (
        <Link href="/lobby" className="mb-3 inline-flex items-center gap-1 self-start text-[14px] text-mist hover:text-cloud">
          <ChevronRight className="size-5" />
          رجوع للغرفة
        </Link>
      )}
      <PageHeader title="الإعدادات" />

      {/* profile */}
      <section className="card flex items-center gap-4 p-4 animate-rise">
        <Avatar avatar={view.me.avatar} color={view.me.color} size={64} glow />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[19px] font-bold font-display">{view.me.name}</p>
          <p className="truncate text-[13px] text-lavender">{view.me.title}</p>
        </div>
        <Button
          variant="soft"
          size="sm"
          onClick={() => {
            setDraft(toDraft(view.me));
            setError(null);
            setEditing(true);
          }}
        >
          <Pencil className="size-3.5" />
          تعديل
        </Button>
      </section>

      {/* calm experience */}
      <section className="mt-7 animate-rise [animation-delay:60ms]">
        <SectionTitle>التجربة</SectionTitle>
        <div className="card divide-y divide-line">
          <div className="flex items-center gap-3 p-4">
            <VolumeX className="size-5 shrink-0 text-lavender" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">من غير صوت</p>
              <p className="text-[12px] text-mist">دُوّا هادي: مفيش موسيقى ولا مؤثرات صوتية.</p>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 p-4">
            <Sparkles className="size-5 shrink-0 text-lavender" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">تهدئة الحركة</p>
              <p className="text-[12px] text-mist">يوقف التوهج والانتقالات المتحركة.</p>
            </div>
            <input type="checkbox" className="peer sr-only" checked={calm} onChange={toggleCalm} />
            <span className="relative h-7 w-12 shrink-0 rounded-full bg-white/12 transition-colors peer-checked:bg-violet peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-lavender after:absolute after:top-1 after:start-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:-translate-x-5 ltr:peer-checked:after:translate-x-5" />
          </label>
        </div>
      </section>

      {/* room */}
      <section className="mt-7 animate-rise [animation-delay:110ms]">
        <SectionTitle>إدارة الغرفة</SectionTitle>
        <InviteCard code={view.code} />
        <p className="mt-3 flex items-start gap-2 text-[13px] leading-6 text-mist">
          <ShieldCheck className="mt-1 size-4 shrink-0 text-mint" />
          {partner
            ? `الغرفة مقفولة عليكم إنتوا الاتنين: إنت و${partner.name}. الكود ده مش بيدخّل حد تالت.`
            : "الكود ده بيدخّل لاعب واحد بس، وبعدها الغرفة بتتقفل عليكم."}
        </p>
        <Button variant="outline" size="md" block className="mt-3" onClick={() => setConfirm("rotate")}>
          <RefreshCw className="size-4" />
          تغيير كود الدعوة
        </Button>
      </section>

      {/* privacy & recovery */}
      <section className="mt-7 animate-rise [animation-delay:160ms]">
        <SectionTitle>الخصوصية والأمان</SectionTitle>
        <div className="card p-4">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <KeyRound className="size-4 text-amber" />
            كود الاستعادة بتاعك
          </p>
          {creds?.recovery ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <span dir="ltr" className="font-latin text-[19px] font-bold tracking-[0.14em]">
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
          ) : (
            <p className="mt-2 text-[13px] text-mist">الكود مش محفوظ على الجهاز ده. اعمل كود جديد عشان تشوفه.</p>
          )}
          <p className="mt-2 text-[12px] leading-5 text-dim">
            بيرجّعك لمكانك من أي جهاز جديد مع كود الغرفة. متشاركوش مع حد.
          </p>
          <Button variant="ghost" size="sm" className="mt-2 -ms-2" onClick={() => setConfirm("recovery")}>
            <RefreshCw className="size-3.5" />
            اعمل كود استعادة جديد
          </Button>
        </div>
        <ul className="mt-3 space-y-2 text-[13px] leading-6 text-mist">
          <li className="flex gap-2">
            <ShieldCheck className="mt-1 size-4 shrink-0 text-mint" />
            من غير إيميل ولا كلمة سر: بنحفظ بس الاسم والصورة الرمزية واللون واللقب.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-1 size-4 shrink-0 text-mint" />
            إجاباتكم ورسوماتكم ونقاطكم محدش بيشوفها غيركم إنتوا الاتنين.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-1 size-4 shrink-0 text-mint" />
            إجابتك مبتظهرش للطرف التاني قبل ما الجولة تتكشف.
          </li>
        </ul>
      </section>

      {/* history */}
      <section className="mt-7 animate-rise [animation-delay:210ms]">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <History className="size-[18px] text-lavender" />
            سجل اللعب
          </span>
        </SectionTitle>
        {items === null ? (
          <div className="card p-4 text-[14px] text-mist">بنحمّل السجل…</div>
        ) : items.length === 0 ? (
          <div className="card p-4 text-[14px] text-mist">لسه مفيش جولات. كل جولة تكمّلوها هتتسجل هنا.</div>
        ) : (
          <ul className="card divide-y divide-line">
            {items.map((it) => {
              const Icon = GAME_ICON[it.gameId];
              const mine = it.earned[view.me.seat];
              return (
                <li key={it.sessionId} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="size-5 shrink-0 text-lavender" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{GAMES[it.gameId].name}</p>
                    <p className="truncate text-[12px] text-mist">
                      {outcomeLine(view, it)} · {relativeTime(it.finishedAt, now())}
                    </p>
                  </div>
                  <span className="num shrink-0 text-[13px] font-bold text-mint">+{mine}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* account */}
      <section className="mt-7 space-y-3 animate-rise [animation-delay:260ms]">
        <SectionTitle>الحساب</SectionTitle>
        <Button variant="soft" size="md" block onClick={() => setConfirm("signout")}>
          <LogOut className="size-4" />
          تسجيل الخروج من الجهاز ده
        </Button>
        <Button variant="danger" size="md" block onClick={() => setConfirm("delete")}>
          <Trash2 className="size-4" />
          حذف حسابي
        </Button>
      </section>

      <p className="mt-8 text-center font-latin text-[10px] tracking-[0.2em] text-dim">DUWA · v0.1</p>

      {/* edit profile */}
      <Sheet open={editing} onClose={busy ? undefined : () => setEditing(false)} labelledBy="edit-title" className="max-h-[92dvh] overflow-y-auto">
        <h2 id="edit-title" className="mb-4 text-[20px] font-bold">
          تعديل الملف الشخصي
        </h2>
        <ProfileForm value={draft} onChange={setDraft} takenColor={partner?.color} takenBy={partner?.name} />
        {error && (
          <Notice tone="rose" className="mt-4">
            {error}
          </Notice>
        )}
        <div className="sticky bottom-0 -mx-5 mt-5 bg-[linear-gradient(180deg,transparent,#17132b_30%)] px-5 pb-2 pt-6">
          <Button block loading={busy} onClick={saveProfile}>
            حفظ
          </Button>
        </div>
      </Sheet>

      {/* confirmations */}
      <Sheet open={confirm !== null} onClose={busy ? undefined : () => setConfirm(null)} labelledBy="confirm-title">
        {confirm && (
          <div className="pb-2">
            <h2 id="confirm-title" className="text-[20px] font-bold">
              {CONFIRM[confirm].title}
            </h2>
            <p className="mt-2 text-[15px] leading-7 text-mist">
              {confirm === "signout" && !creds?.recovery
                ? "مفيش كود استعادة محفوظ على الجهاز ده. اعمل كود جديد الأول، وإلا مش هتعرف ترجع لمكانك."
                : CONFIRM[confirm].body}
            </p>
            {confirm === "signout" && creds?.recovery && (
              <p dir="ltr" className="mt-3 rounded-2xl bg-white/6 py-3 text-center font-latin text-[18px] font-bold tracking-[0.14em]">
                {prettyRecovery(creds.recovery)}
              </p>
            )}
            {error && (
              <Notice tone="rose" className="mt-4">
                {error}
              </Notice>
            )}
            <div className="mt-6 grid gap-2.5">
              <Button block variant={CONFIRM[confirm].danger ? "danger" : "primary"} loading={busy} onClick={confirmAction}>
                {CONFIRM[confirm].action}
              </Button>
              <Button block variant="ghost" size="md" disabled={busy} onClick={() => setConfirm(null)}>
                رجوع
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

const CONFIRM: Record<Exclude<Confirm, null>, { title: string; body: string; action: string; danger?: boolean }> = {
  rotate: {
    title: "تغيير كود الدعوة؟",
    body: "الكود القديم هيبطل فورًا. إنتوا الاتنين هتفضلوا في الغرفة عادي، بس أي دعوة قديمة مش هتشتغل.",
    action: "غيّر الكود",
  },
  recovery: {
    title: "كود استعادة جديد؟",
    body: "الكود القديم هيبطل، والجديد هيظهر هنا على الجهاز ده. احتفظ بيه في مكان آمن.",
    action: "اعمل كود جديد",
  },
  signout: {
    title: "تسجيل الخروج من الجهاز ده؟",
    body: "مكانك ونقاطك هيفضلوا محفوظين. عشان ترجع هتحتاج كود الغرفة وكود الاستعادة ده:",
    action: "سجّل الخروج",
  },
  delete: {
    title: "حذف حسابك نهائيًا؟",
    body: "هيتمسح اسمك ونقاطك وأوسمتك الفردية، ومكانك في الغرفة هيفضى وكود الدعوة هيتغيّر. لو إنت آخر لاعب، الغرفة كلها هتتمسح. الخطوة دي ملهاش رجوع.",
    action: "احذف حسابي",
    danger: true,
  },
};

function toDraft(me: { name: string; gender: "m" | "f"; avatar: string; color: string; title: string }): ProfileDraft {
  return { name: me.name, gender: me.gender, avatar: me.avatar as AvatarId, color: me.color as ColorId, title: me.title };
}
