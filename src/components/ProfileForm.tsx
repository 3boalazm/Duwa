"use client";

import { useState } from "react";
import { Check, PenLine } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { TextField } from "@/components/ui";
import {
  AVATAR_NAMES,
  AVATARS,
  COLORS,
  type Gender,
  GENDERS,
  NAME_MAX,
  type Profile,
  TITLE_MAX,
  TITLES_BY_GENDER,
} from "@/game/profile";
import { cn } from "@/lib/cn";

/** A profile being edited: the gender starts unanswered on purpose. */
export type ProfileDraft = Omit<Profile, "gender"> & { gender: Gender | "" };

export const EMPTY_PROFILE: ProfileDraft = { name: "", gender: "", avatar: "cat", color: "violet", title: "" };

const ALL_PRESETS = [...TITLES_BY_GENDER.m, ...TITLES_BY_GENDER.f];

/** Name, wording, avatar, colour and title pickers with a live player card on top. */
export function ProfileForm({
  value,
  onChange,
  takenColor,
  takenBy,
}: {
  value: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
  /** the other player's colour — each player needs their own */
  takenColor?: string;
  takenBy?: string;
}) {
  const [custom, setCustom] = useState(value.title !== "" && !ALL_PRESETS.includes(value.title));
  const set = <K extends keyof ProfileDraft>(key: K, v: ProfileDraft[K]) => onChange({ ...value, [key]: v });
  const titles = value.gender ? TITLES_BY_GENDER[value.gender] : [];

  const pickGender = (gender: Gender) => {
    // Keep the same title in its matching form (ملك ↔ ملكة) when switching.
    let title = value.title;
    if (!custom) {
      const from = value.gender ? TITLES_BY_GENDER[value.gender].indexOf(value.title) : -1;
      title = TITLES_BY_GENDER[gender][from >= 0 ? from : 0];
    }
    onChange({ ...value, gender, title });
  };

  return (
    <div className="space-y-7">
      {/* live player card */}
      <div className="card-glow flex items-center gap-4 p-4">
        <Avatar avatar={value.avatar} color={value.color} size={84} glow />
        <div className="min-w-0">
          <p className={cn("truncate text-[22px] font-bold font-display", !value.name && "text-dim")}>
            {value.name || "اسمك هنا"}
          </p>
          <p className={cn("mt-0.5 truncate text-[14px]", value.title ? "text-lavender" : "text-dim")}>{value.title || "لقبك هنا"}</p>
        </div>
      </div>

      <section>
        <label htmlFor="pf-name" className="mb-2 block text-[14px] font-semibold text-mist">
          الاسم
        </label>
        <TextField
          id="pf-name"
          value={value.name}
          maxLength={NAME_MAX}
          placeholder="الاسم اللي هيظهر في اللعب"
          autoComplete="nickname"
          enterKeyHint="done"
          onChange={(e) => set("name", e.target.value)}
        />
      </section>

      <section>
        <h3 className="mb-2 text-[14px] font-semibold text-mist font-sans">أنا…</h3>
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="لاعب ولا لاعبة">
          {GENDERS.map((g) => {
            const active = value.gender === g.id;
            return (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pickGender(g.id)}
                className={cn(
                  "h-12 rounded-2xl border text-[16px] font-semibold transition-all duration-200",
                  active ? "border-violet bg-violet/20 text-cloud shadow-glow" : "border-line-2 text-mist hover:text-cloud",
                )}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] text-dim">عشان دُوّا يتكلم عنك صح: «جاوب» ولا «جاوبت».</p>
      </section>

      <section>
        <h3 className="mb-2 text-[14px] font-semibold text-mist font-sans">الصورة الرمزية</h3>
        <div className="grid grid-cols-6 gap-2.5" role="radiogroup" aria-label="الصورة الرمزية">
          {AVATARS.map((id) => {
            const active = value.avatar === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={AVATAR_NAMES[id]}
                onClick={() => set("avatar", id)}
                className={cn(
                  "grid aspect-square place-items-center rounded-2xl border transition-all duration-200",
                  active ? "border-violet bg-violet/15 shadow-glow scale-105" : "border-transparent hover:bg-white/5",
                )}
              >
                <Avatar avatar={id} color={value.color} size={44} />
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[14px] font-semibold text-mist font-sans">لونك المميز</h3>
        <div className="flex items-center justify-between" role="radiogroup" aria-label="اللون">
          {COLORS.map((c) => {
            const active = value.color === c.id;
            const taken = takenColor === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={taken ? `${c.name} — مع ${takenBy ?? "اللاعب التاني"}` : c.name}
                disabled={taken}
                onClick={() => set("color", c.id)}
                className={cn(
                  "relative grid size-[34px] place-items-center rounded-full transition-transform duration-200",
                  active && "scale-110",
                  taken && "opacity-25",
                )}
                style={{
                  background: c.hex,
                  boxShadow: active ? `0 0 0 3px #090b18, 0 0 0 5px ${c.hex}, 0 0 22px ${c.hex}` : "inset 0 0 0 1px rgb(255 255 255 / 0.25)",
                }}
              >
                {active && <Check className="size-[18px] text-midnight" strokeWidth={3.2} />}
              </button>
            );
          })}
        </div>
        {takenColor && takenBy && <p className="mt-2 text-[12px] text-dim">اللون الباهت مع {takenBy}.</p>}
      </section>

      <section>
        <h3 className="mb-2 text-[14px] font-semibold text-mist font-sans">اللقب</h3>
        {!value.gender ? (
          <p className="rounded-2xl border border-dashed border-line-2 px-4 py-3 text-[13px] text-dim">
            اختار «لاعب» أو «لاعبة» فوق عشان تظهر الألقاب المناسبة.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {titles.map((t) => {
                const active = !custom && value.title === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setCustom(false);
                      set("title", t);
                    }}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[14px] transition-colors",
                      active ? "border-violet bg-violet/25 text-cloud" : "border-line-2 text-mist hover:text-cloud",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={custom}
                onClick={() => {
                  if (!custom) set("title", "");
                  setCustom(true);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[14px] transition-colors",
                  custom ? "border-violet bg-violet/25 text-cloud" : "border-dashed border-line-2 text-mist hover:text-cloud",
                )}
              >
                <PenLine className="size-3.5" />
                لقب من عندي
              </button>
            </div>
            {custom && (
              <TextField
                className="mt-3"
                value={value.title}
                maxLength={TITLE_MAX}
                placeholder="اكتب لقبك"
                aria-label="لقب من عندي"
                onChange={(e) => set("title", e.target.value)}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
