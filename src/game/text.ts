/**
 * Arabic-aware text helpers used by the server to judge typed answers.
 * Egyptian dialect spellings vary a lot (أ/ا, ة/ه, ى/ي, ث/ت …), so answers are
 * compared through a forgiving canonical form.
 */

const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

/** Lower-case, strip diacritics/tatweel/punctuation and unify look-alike letters. */
export function normalizeAr(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(TASHKEEL, "")
    .replace(/\u0640/g, "") // tatweel
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") // آ أ إ ٱ → ا
    .replace(/\u0649/g, "\u064A") // ى → ي
    .replace(/\u0629/g, "\u0647") // ة → ه
    .replace(/\u0624/g, "\u0648") // ؤ → و
    .replace(/\u0626/g, "\u064A") // ئ → ي
    .replace(/\u0621/g, "") // ء
    .replace(/\u06A9/g, "\u0643") // ک → ك
    .replace(/\u06CC/g, "\u064A") // ی → ي
    .replace(/\u0686/g, "\u062C") // چ → ج
    .replace(/\u06A4/g, "\u0641") // ڤ → ف
    .replace(/\u06AF/g, "\u062C") // گ → ج
    .replace(/\u067E/g, "\u0628") // پ → ب
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collapse any run of the same character ("لاااا" → "لا"). */
export function squash(input: string): string {
  return input.replace(/(.)\1+/gu, "$1");
}

/**
 * Canonical key for comparing words: normalised, definite article removed,
 * long letter runs collapsed and spaces dropped ("الآيس كريم" ≡ "ايسكريم").
 */
export function wordKey(input: string): string {
  return normalizeAr(input)
    .split(" ")
    .filter(Boolean)
    .map((t) => (t.length >= 4 && t.startsWith("\u0627\u0644") ? t.slice(2) : t))
    .map((t) => t.replace(/(.)\1{2,}/gu, "$1"))
    .join("");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const A = Array.from(a);
  const B = Array.from(b);
  if (!A.length) return B.length;
  if (!B.length) return A.length;
  let prev = Array.from({ length: B.length + 1 }, (_, i) => i);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[B.length];
}

export type Closeness = "exact" | "close" | "none";

/** How close two typed words are (used by «أول كلمة» and drawing guesses). */
export function closeness(a: string, b: string): Closeness {
  const ka = wordKey(a);
  const kb = wordKey(b);
  if (!ka || !kb) return "none";
  if (ka === kb) return "exact";
  const longer = Math.max(Array.from(ka).length, Array.from(kb).length);
  const shorter = Math.min(Array.from(ka).length, Array.from(kb).length);
  if (shorter >= 3 && (ka.startsWith(kb) || kb.startsWith(ka)) && longer - shorter <= 2) return "close";
  const d = levenshtein(ka, kb);
  if (longer >= 4 && d <= 1) return "close";
  if (longer >= 7 && d <= 2) return "close";
  return "none";
}

/* ------------------------------------------------------------------ */
/*  «ممنوع آه ولا لأ»                                                    */
/* ------------------------------------------------------------------ */
const FORBIDDEN = new Set(
  [
    // yes
    "اه",
    "اها",
    "ايوه",
    "ايوا",
    "نعم",
    "اجل",
    "yes",
    "yeah",
    "yea",
    "yep",
    "yup",
    "ah",
    "aywa",
    "aiwa",
    "aywah",
    // no
    "لا",
    "لاه",
    "كلا",
    "no",
    "nope",
    "nah",
    "la",
    "la2",
    "laa",
  ].map((w) => squash(w)),
);

/** Returns the forbidden word the player slipped into their answer, if any. */
export function findForbidden(answer: string): string | null {
  const tokens = normalizeAr(answer).split(" ").filter(Boolean);
  for (const token of tokens) {
    if (FORBIDDEN.has(squash(token))) return token;
  }
  return null;
}

/** Number of letters shown as blanks to the guesser in «خمن الرسمة». */
export function letterCount(word: string): number {
  return Array.from(word.normalize("NFKC").replace(TASHKEEL, "").replace(/[^\p{L}\p{N}]/gu, "")).length;
}
