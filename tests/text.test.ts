import { describe, expect, it } from "vitest";
import { closeness, findForbidden, letterCount, normalizeAr, wordKey } from "@/game/text";
import { judgeNoYes } from "@/game/games/noyes";

describe("normalizeAr", () => {
  it("unifies hamza, taa marbuta, alef maqsura and strips diacritics", () => {
    expect(normalizeAr("أَحْمَد")).toBe("احمد");
    expect(normalizeAr("مدرسة")).toBe("مدرسه");
    expect(normalizeAr("مستشفى")).toBe("مستشفي");
    expect(normalizeAr("  آيس   كريم!! ")).toBe("ايس كريم");
    expect(normalizeAr("ـــجميل")).toBe("جميل");
  });
});

describe("wordKey", () => {
  it("ignores the definite article, spacing and stretched letters", () => {
    expect(wordKey("البحر")).toBe(wordKey("بحر"));
    expect(wordKey("الآيس كريم")).toBe(wordKey("ايسكريم"));
    expect(wordKey("قطة")).toBe(wordKey("قطه"));
    expect(wordKey("جميييييل")).toBe(wordKey("جميل"));
  });
  it("keeps short words that merely start with ال", () => {
    expect(wordKey("الم")).toBe("الم");
  });
});

describe("closeness", () => {
  it("detects exact and near matches", () => {
    expect(closeness("البحر", "بحر")).toBe("exact");
    expect(closeness("سمك", "سمكة")).toBe("close");
    expect(closeness("بحر", "بحار")).toBe("close");
    expect(closeness("قهوة", "شاي")).toBe("none");
    expect(closeness("", "شاي")).toBe("none");
  });
});

describe("findForbidden (ممنوع آه ولا لأ)", () => {
  it.each(["آه", "اه طبعا", "أيوه", "ايوة يا عم", "نعم", "لأ", "لا", "لاااااا", "لأ خالص", "آآآه", "لاء", "yes", "No way"])(
    "catches %s",
    (answer) => {
      expect(findForbidden(answer)).not.toBeNull();
    },
  );
  it.each(["طبعًا", "أكيد", "مستحيل", "ولا حاجة", "ممكن", "إيه ده", "بلاش", "لازم", "آهات كتير", "الله أعلم"])(
    "allows %s",
    (answer) => {
      expect(findForbidden(answer)).toBeNull();
    },
  );
  it("judges empty and repeated answers", () => {
    expect(judgeNoYes("", []).verdict).toBe("empty");
    expect(judgeNoYes("ا", []).verdict).toBe("empty");
    const first = judgeNoYes("أكيد", []);
    expect(first.verdict).toBe("ok");
    expect(judgeNoYes("اكيد!", [first.key]).verdict).toBe("repeat");
    expect(judgeNoYes("أيوه أكيد", [first.key]).verdict).toBe("forbidden");
  });
});

describe("letterCount", () => {
  it("counts letters without diacritics or spaces", () => {
    expect(letterCount("قطة")).toBe(3);
    expect(letterCount("دُوّا")).toBe(3);
  });
});
