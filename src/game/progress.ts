/**
 * Rewards: DUWA Points, achievements, «رحلتنا» stages and world unlocks.
 * Everything here runs on the server when a session ends — the phones only
 * display the result.
 */
import { GAMES, PLAYABLE_GAMES, POINTS, WORLDS, type PlayableGameId, type WorldId } from "./catalog";
import type {
  Award,
  AwardReason,
  Ctx,
  Outcome,
  Owner,
  RoomAgg,
  Seat,
  SessionResult,
  SessionState,
} from "./types";
import { SEATS } from "./types";

export interface FinishFacts {
  gameId: PlayableGameId;
  outcome: Outcome;
  agg: RoomAgg;
}

const fact = (f: FinishFacts, key: string) => f.outcome.facts[key];

/* ------------------------------------------------------------------ */
/*  Achievements                                                        */
/* ------------------------------------------------------------------ */
export type BadgeIcon =
  | "trophy"
  | "flame"
  | "crown"
  | "eye"
  | "shield"
  | "zap"
  | "brush"
  | "list"
  | "rocket"
  | "medal"
  | "star"
  | "waves"
  | "palette"
  | "heart"
  | "compass"
  | "gamepad";

export interface AchievementDef {
  key: string;
  scope: "solo" | "duo";
  name: string;
  desc: string;
  /** bonus DUWA Points when unlocked */
  reward: number;
  icon: BadgeIcon;
  earned: (f: FinishFacts, seat: Seat) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- duo ---
  {
    key: "first_step",
    scope: "duo",
    name: "أول خطوة",
    desc: "كمّلتوا أول جولة سوا.",
    reward: 5,
    icon: "rocket",
    earned: (f) => f.agg.progress.sessions >= 1,
  },
  {
    key: "ten_rounds",
    scope: "duo",
    name: "عشرة على عشرة",
    desc: "لعبتوا 10 جولات مع بعض.",
    reward: 10,
    icon: "medal",
    earned: (f) => f.agg.progress.sessions >= 10,
  },
  {
    key: "regulars",
    scope: "duo",
    name: "أصحاب المكان",
    desc: "لعبتوا 25 جولة مع بعض.",
    reward: 15,
    icon: "star",
    earned: (f) => f.agg.progress.sessions >= 25,
  },
  {
    key: "same_wave",
    scope: "duo",
    name: "على نفس الموجة",
    desc: "3 توافقات ورا بعض في «أول كلمة».",
    reward: 10,
    icon: "waves",
    earned: (f) => f.gameId === "word" && Number(fact(f, "bestRun")) >= 3,
  },
  {
    key: "gallery",
    scope: "duo",
    name: "معرض فني",
    desc: "كل الرسمات اتخمنت في جولة «خمن الرسمة».",
    reward: 10,
    icon: "palette",
    earned: (f) => f.gameId === "draw" && fact(f, "allSolved") === true,
  },
  {
    key: "one_heart",
    scope: "duo",
    name: "قلب واحد",
    desc: "اتفقتوا في كل كروت «مين فينا» في جولة واحدة.",
    reward: 10,
    icon: "heart",
    earned: (f) => f.gameId === "envelope" && fact(f, "agreeAll") === true,
  },
  {
    key: "explorers",
    scope: "duo",
    name: "مستكشفين",
    desc: "فتحتوا عالم الذكاء والألغاز.",
    reward: 10,
    icon: "compass",
    earned: (f) => f.agg.shared >= 100,
  },
  {
    key: "all_six",
    scope: "duo",
    name: "جرّبنا كل حاجة",
    desc: "لعبتوا كل ألعاب النسخة الأولى مرة على الأقل.",
    reward: 15,
    icon: "gamepad",
    earned: (f) => PLAYABLE_GAMES.every((g) => (f.agg.progress.plays[g] ?? 0) >= 1),
  },
  // --- solo ---
  {
    key: "first_win",
    scope: "solo",
    name: "أول فوز",
    desc: "أول فوز بجولة.",
    reward: 5,
    icon: "trophy",
    earned: (f, seat) => (f.agg.players[seat]?.stats.wins ?? 0) >= 1,
  },
  {
    key: "hat_trick",
    scope: "solo",
    name: "هاتريك",
    desc: "3 انتصارات ورا بعض.",
    reward: 10,
    icon: "flame",
    earned: (f, seat) => (f.agg.players[seat]?.stats.streak ?? 0) >= 3,
  },
  {
    key: "champion",
    scope: "solo",
    name: "بطل دُوّا",
    desc: "10 انتصارات.",
    reward: 15,
    icon: "crown",
    earned: (f, seat) => (f.agg.players[seat]?.stats.wins ?? 0) >= 10,
  },
  {
    key: "mind_reader",
    scope: "solo",
    name: "قارئ أفكار",
    desc: "كل التوقعات صح في جولة «خمن إجابتي».",
    reward: 10,
    icon: "eye",
    earned: (f, seat) => f.gameId === "guess" && fact(f, `perfect${seat}`) === true,
  },
  {
    key: "iron_tongue",
    scope: "solo",
    name: "لسان من حديد",
    desc: "إنهاء «ممنوع آه ولا لأ» بالتلات قلوب.",
    reward: 10,
    icon: "shield",
    earned: (f, seat) => f.gameId === "noyes" && f.outcome.hard[seat],
  },
  {
    key: "hawk_eye",
    scope: "solo",
    name: "عين صقر",
    desc: "تخمين رسمة في 10 ثواني أو أقل.",
    reward: 10,
    icon: "zap",
    earned: (f, seat) => f.gameId === "draw" && fact(f, `flash${seat}`) === true,
  },
  {
    key: "picasso",
    scope: "solo",
    name: "بيكاسو",
    desc: "رسمة اتخمنت في 15 ثانية أو أقل.",
    reward: 10,
    icon: "brush",
    earned: (f, seat) => f.gameId === "draw" && fact(f, `clear${seat}`) === true,
  },
  {
    key: "word_machine",
    scope: "solo",
    name: "ماكينة كلمات",
    desc: "12 إجابة صح في تحدي واحد من «تحدي الدقيقة».",
    reward: 10,
    icon: "list",
    earned: (f, seat) => f.gameId === "minute" && Number(fact(f, `best${seat}`)) >= 12,
  },
];

export const achievementByKey = (key: string) => ACHIEVEMENTS.find((a) => a.key === key);

/* ------------------------------------------------------------------ */
/*  «رحلتنا» — sequential co-op missions                                 */
/* ------------------------------------------------------------------ */
export interface JourneyStage {
  key: string;
  name: string;
  desc: string;
  /** game this stage is played in, if any (lets the UI link straight to it) */
  game?: PlayableGameId;
  done: (f: FinishFacts) => boolean;
}

export const JOURNEY: JourneyStage[] = [
  {
    key: "start",
    name: "أول جولة سوا",
    desc: "كمّلوا أي جولة مع بعض.",
    done: (f) => f.agg.progress.sessions >= 1,
  },
  {
    key: "mind",
    name: "قراءة أفكار",
    desc: "في «خمن إجابتي»: 5 توقعات صح مع بعض في جولة واحدة.",
    game: "guess",
    done: (f) => f.gameId === "guess" && Number(fact(f, "hits")) >= 5,
  },
  {
    key: "tongue",
    name: "لسان حريف",
    desc: "في «ممنوع آه ولا لأ»: كمّلوا للآخر من غير ما حد يخسر كل قلوبه.",
    game: "noyes",
    done: (f) => f.gameId === "noyes" && fact(f, "survived") === true,
  },
  {
    key: "artists",
    name: "فنانين",
    desc: "في «خمن الرسمة»: 3 رسمات تتخمن صح في جولة واحدة.",
    game: "draw",
    done: (f) => f.gameId === "draw" && Number(fact(f, "solved")) >= 3,
  },
  {
    key: "heart",
    name: "افتحوا قلبكم",
    desc: "في «الظرف المجهول»: كمّلوا الجولة من غير ما تسيبوا سؤال فاضي.",
    game: "envelope",
    done: (f) => f.gameId === "envelope" && Number(fact(f, "blanks")) === 0,
  },
  {
    key: "gate",
    name: "بوابة الذكاء",
    desc: "اوصلوا لـ 100 نقطة في الرصيد المشترك.",
    done: (f) => f.agg.shared >= 100,
  },
  {
    key: "wave",
    name: "نفس الموجة",
    desc: "في «أول كلمة»: 3 توافقات تامة في جولة واحدة.",
    game: "word",
    done: (f) => f.gameId === "word" && Number(fact(f, "exact")) >= 3,
  },
  {
    key: "sprint",
    name: "سباق الدقيقة",
    desc: "في «تحدي الدقيقة»: 20 إجابة صح مع بعض في جولة واحدة.",
    game: "minute",
    done: (f) => f.gameId === "minute" && Number(fact(f, "total")) >= 20,
  },
  {
    key: "everything",
    name: "جولة في كل الألعاب",
    desc: "العبوا الست ألعاب كلها مرة على الأقل.",
    done: (f) => PLAYABLE_GAMES.every((g) => (f.agg.progress.plays[g] ?? 0) >= 1),
  },
  {
    key: "golden",
    name: "الثنائي الذهبي",
    desc: "اوصلوا لـ 250 نقطة في الرصيد المشترك.",
    done: (f) => f.agg.shared >= 250,
  },
];

/* ------------------------------------------------------------------ */
/*  Finishing a session                                                 */
/* ------------------------------------------------------------------ */
const LABELS: Record<Exclude<AwardReason, "achievement" | "journey">, string> = {
  complete: "إكمال الجولة",
  win: "الفوز بالجولة",
  tie: "تعادل",
  hard: "تحدي صعب",
  team: "مهمة جماعية",
};

/**
 * Close the books on a finished session: update statistics, hand out points
 * (personal + shared), then check achievements, journey stages and unlocks.
 * Points are never taken away — losing simply earns less.
 */
export function settle(agg: RoomAgg, s: SessionState, outcome: Outcome, ctx: Ctx): SessionResult {
  const gameId = s.gameId;
  const sharedBefore = agg.shared;
  const awards: Award[] = [];
  const earned: [number, number] = [0, 0];

  const give = (to: Owner, reason: AwardReason, points: number, label: string, suffix = "") => {
    if (points <= 0) return;
    if (to !== 2) {
      const p = agg.players[to];
      if (!p) return;
      p.points += points;
      earned[to] += points;
    }
    agg.shared += points;
    awards.push({ to, reason, points, label });
    ctx.fx.scores.push({ to, reason, points, key: `${s.id}:${to}:${reason}${suffix}`, sessionId: s.id });
  };

  // --- statistics -----------------------------------------------------
  agg.progress.sessions += 1;
  agg.progress.plays[gameId] = (agg.progress.plays[gameId] ?? 0) + 1;
  for (const seat of SEATS) {
    const p = agg.players[seat];
    if (!p) continue;
    const st = p.stats;
    st.sessions += 1;
    const g = (st.games[gameId] ??= { plays: 0, wins: 0 });
    g.plays += 1;
    if (!outcome.coop) {
      if (outcome.winner === null) {
        st.ties += 1;
      } else if (outcome.winner === seat) {
        st.wins += 1;
        g.wins += 1;
        st.streak += 1;
        st.bestStreak = Math.max(st.bestStreak, st.streak);
      } else {
        st.losses += 1;
        st.streak = 0;
      }
    }
  }

  // --- points for the round ---------------------------------------------
  for (const seat of SEATS) give(seat, "complete", POINTS.complete, LABELS.complete);
  if (!outcome.coop) {
    if (outcome.winner === null) for (const seat of SEATS) give(seat, "tie", POINTS.tie, LABELS.tie);
    else give(outcome.winner, "win", POINTS.win, LABELS.win);
  }
  for (const seat of SEATS) if (outcome.hard[seat]) give(seat, "hard", POINTS.hard, LABELS.hard);
  if (outcome.team) give(2, "team", POINTS.team, LABELS.team);

  // --- achievements & journey (rewards can cascade, so loop a little) ----
  const facts: FinishFacts = { gameId, outcome, agg };
  const newAchievements: { key: string; to: Owner }[] = [];
  const newStages: string[] = [];
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;

    for (const def of ACHIEVEMENTS) {
      const owners: Owner[] = def.scope === "duo" ? [2] : SEATS;
      for (const to of owners) {
        if (agg.achievements.some((a) => a.key === def.key && a.to === to)) continue;
        if (to !== 2 && !agg.players[to]) continue;
        if (!def.earned(facts, to === 2 ? 0 : to)) continue;
        const record = { key: def.key, to, at: ctx.now };
        agg.achievements.push(record);
        ctx.fx.achievements.push(record);
        newAchievements.push({ key: def.key, to });
        give(to, "achievement", def.reward, `إنجاز: ${def.name}`, `:${def.key}`);
        changed = true;
      }
    }

    while (agg.progress.journey < JOURNEY.length && JOURNEY[agg.progress.journey].done(facts)) {
      const stage = JOURNEY[agg.progress.journey];
      agg.progress.journey += 1;
      newStages.push(stage.key);
      give(2, "journey", POINTS.journey, `رحلتنا: ${stage.name}`, `:${stage.key}`);
      changed = true;
    }

    if (!changed) break;
  }

  // --- world unlocks (shared balance only ever goes up) ------------------
  const unlocked = recordUnlocks(agg, ctx);

  const result: SessionResult = {
    sessionId: s.id,
    gameId,
    finishedAt: ctx.now,
    coop: outcome.coop,
    winner: outcome.winner,
    score: [s.score[0], s.score[1]],
    team: s.team,
    headline: outcome.headline,
    awards,
    earned,
    sharedBefore,
    sharedAfter: agg.shared,
    unlocked,
    achievements: newAchievements,
    journey: newStages,
    log: s.log,
  };

  agg.progress.last = {
    sessionId: s.id,
    gameId,
    finishedAt: ctx.now,
    coop: outcome.coop,
    winner: outcome.winner,
    score: result.score,
    headline: outcome.headline,
  };

  return result;
}

/** Record every world whose threshold the shared balance has reached. */
export function recordUnlocks(agg: RoomAgg, ctx: Ctx): WorldId[] {
  const fresh: WorldId[] = [];
  for (const w of WORLDS) {
    if (agg.shared < w.threshold) continue;
    if (agg.unlocks.some((u) => u.world === w.id)) continue;
    const record = { world: w.id, at: ctx.now };
    agg.unlocks.push(record);
    ctx.fx.unlocks.push(record);
    // The two starter worlds are open from the first second: not "news".
    if (w.threshold > 0) fresh.push(w.id);
  }
  return fresh;
}

export function gameUnlocked(agg: RoomAgg, gameId: PlayableGameId): boolean {
  const world = WORLDS.find((w) => w.id === GAMES[gameId].world);
  if (!world) return false;
  return agg.shared >= world.threshold || agg.unlocks.some((u) => u.world === world.id);
}
