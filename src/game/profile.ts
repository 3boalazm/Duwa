/**
 * Player profile building blocks (shared by client and server).
 * The server validates every profile against these lists.
 */

export const AVATARS = [
  "cat",
  "fox",
  "bear",
  "bunny",
  "panda",
  "owl",
  "robot",
  "alien",
  "ghost",
  "astro",
  "moon",
  "planet",
] as const;
export type AvatarId = (typeof AVATARS)[number];

export const AVATAR_NAMES: Record<AvatarId, string> = {
  cat: "قطة",
  fox: "ثعلب",
  bear: "دب",
  bunny: "أرنب",
  panda: "باندا",
  owl: "بومة",
  robot: "روبوت",
  alien: "فضائي",
  ghost: "شبح",
  astro: "رائد فضاء",
  moon: "قمر",
  planet: "كوكب",
};

export const COLORS = [
  { id: "violet", name: "بنفسجي", hex: "#8F6BFF" },
  { id: "pink", name: "وردي", hex: "#FF6FB1" },
  { id: "coral", name: "مرجاني", hex: "#FF8364" },
  { id: "amber", name: "ذهبي", hex: "#FFC24B" },
  { id: "mint", name: "نعناعي", hex: "#3DDC97" },
  { id: "cyan", name: "سماوي", hex: "#38D6F5" },
  { id: "blue", name: "أزرق", hex: "#5B8DFF" },
  { id: "lilac", name: "لافندر", hex: "#C9B8FF" },
] as const;
export type ColorId = (typeof COLORS)[number]["id"];

export function colorHex(id: string): string {
  return COLORS.find((c) => c.id === id)?.hex ?? COLORS[0].hex;
}

/**
 * Arabic verbs and adjectives agree with gender, so each player says how the
 * app should talk about them ("مصطفى جاوب" / "سارة جاوبت").
 */
export type Gender = "m" | "f";
export const GENDERS: { id: Gender; label: string }[] = [
  { id: "f", label: "لاعبة" },
  { id: "m", label: "لاعب" },
];

/** Picks the masculine or feminine wording for a player. */
export function gx(player: { gender?: string } | null | undefined, masculine: string, feminine: string): string {
  return player?.gender === "f" ? feminine : masculine;
}

/** Ready-made titles; players can also write their own. */
export const TITLES_BY_GENDER: Record<Gender, readonly string[]> = {
  m: [
    "ملك التحديات",
    "دماغ عالية",
    "نجم السهرة",
    "صاحب المزاج",
    "الكابتن",
    "المحقق",
    "الأسطورة",
    "أمير الألغاز",
    "الجوكر",
    "القناص",
    "ملك الدراما",
    "العبقري",
  ],
  f: [
    "ملكة التحديات",
    "دماغ عالية",
    "نجمة السهرة",
    "صاحبة المزاج",
    "ست الكل",
    "المحققة",
    "الأسطورة",
    "أميرة الألغاز",
    "الجوكر",
    "القناصة",
    "ملكة الدراما",
    "العبقرية",
  ],
};

export const NAME_MAX = 16;
export const TITLE_MAX = 22;

export interface Profile {
  name: string;
  gender: Gender;
  avatar: AvatarId;
  color: ColorId;
  title: string;
}

/** Collapse whitespace and strip control / bidi-override characters. */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export type ProfileError = "name" | "gender" | "avatar" | "color" | "title";

export function parseProfile(input: unknown): { ok: true; profile: Profile } | { ok: false; error: ProfileError } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const name = cleanText(raw.name, NAME_MAX);
  if (name.length < 2) return { ok: false, error: "name" };
  const gender = raw.gender as Gender;
  if (gender !== "m" && gender !== "f") return { ok: false, error: "gender" };
  const avatar = raw.avatar as AvatarId;
  if (!AVATARS.includes(avatar)) return { ok: false, error: "avatar" };
  const color = raw.color as ColorId;
  if (!COLORS.some((c) => c.id === color)) return { ok: false, error: "color" };
  const title = cleanText(raw.title, TITLE_MAX);
  if (title.length < 2) return { ok: false, error: "title" };
  return { ok: true, profile: { name, gender, avatar, color, title } };
}

export const PROFILE_ERRORS: Record<ProfileError, string> = {
  name: "اكتب اسم من حرفين على الأقل.",
  gender: "اختار: لاعب ولا لاعبة؟ عشان دُوّا يكلمكم صح.",
  avatar: "اختار صورة رمزية.",
  color: "اختار لون.",
  title: "اختار لقب أو اكتب واحد من عندك.",
};
