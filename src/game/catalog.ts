/**
 * The DUWA universe: six worlds, twelve games, and the unlock map.
 * Static content shared by the client (to render) and the server (to enforce).
 *
 * Numbers follow the agreed first balance pass and are meant to be tuned
 * after real play-testing.
 */

export type WorldId = "laugh" | "know" | "brain" | "versus" | "adventure" | "surprise";

export type PlayableGameId = "guess" | "noyes" | "draw" | "envelope" | "word" | "minute";
export type GameId = PlayableGameId | "quick" | "memory" | "rps" | "four" | "secret" | "words";

export const PLAYABLE_GAMES: PlayableGameId[] = ["guess", "noyes", "draw", "envelope", "word", "minute"];

export function isPlayable(id: string): id is PlayableGameId {
  return (PLAYABLE_GAMES as string[]).includes(id);
}

export interface World {
  id: WorldId;
  name: string;
  short: string;
  blurb: string;
  /** shared DUWA Points needed to open the world */
  threshold: number;
  /** two-stop gradient used for the world's art */
  hue: [string, string];
  games: GameId[];
}

export const WORLDS: World[] = [
  {
    id: "laugh",
    name: "عالم الضحك",
    short: "الضحك",
    blurb: "هزار وقفشات من أول جولة.",
    threshold: 0,
    hue: ["#FF8364", "#FF6FB1"],
    games: ["noyes", "draw"],
  },
  {
    id: "know",
    name: "عالم التعارف والتوقعات",
    short: "التعارف",
    blurb: "قد إيه عارفين بعض بجد؟",
    threshold: 0,
    hue: ["#B19AFF", "#8155EF"],
    games: ["guess", "envelope", "quick"],
  },
  {
    id: "brain",
    name: "عالم الذكاء والألغاز",
    short: "الذكاء",
    blurb: "كلمات، سرعة بديهة، وتركيز.",
    threshold: 100,
    hue: ["#38D6F5", "#5B6CFF"],
    games: ["word", "minute", "memory"],
  },
  {
    id: "versus",
    name: "عالم المنافسة",
    short: "المنافسة",
    blurb: "واحد قصاد واحد… ومفيش مجاملات.",
    threshold: 250,
    hue: ["#FFC24B", "#FF8364"],
    games: ["rps", "four"],
  },
  {
    id: "adventure",
    name: "عالم المغامرات",
    short: "المغامرات",
    blurb: "ألغاز متتابعة تتحل بالتعاون.",
    threshold: 450,
    hue: ["#3DDC97", "#38D6F5"],
    games: ["secret", "words"],
  },
  {
    id: "surprise",
    name: "عالم المفاجآت",
    short: "المفاجآت",
    blurb: "العالم السري: ألعاب ومهمات خاصة.",
    threshold: 700,
    hue: ["#FF6FB1", "#8155EF"],
    games: [],
  },
];

export interface GameInfo {
  id: GameId;
  world: WorldId;
  name: string;
  /** game type label */
  kind: string;
  tagline: string;
  /** how to play, three short steps */
  how: string[];
  mode: "versus" | "coop";
  minutes: string;
  rounds: string;
  playable: boolean;
}

export const GAMES: Record<GameId, GameInfo> = {
  guess: {
    id: "guess",
    world: "know",
    name: "خمن إجابتي",
    kind: "تعارف",
    tagline: "جاوب عن نفسك… وتوقّع إجابة التاني.",
    how: [
      "يظهر سؤال واحد للاتنين في نفس اللحظة.",
      "كل واحد يختار إجابته سرًّا، وبعدها يتوقع إجابة التاني.",
      "الإجابات تتكشف مع بعض، وكل توقع صح بنقطة.",
    ],
    mode: "versus",
    minutes: "3 دقايق",
    rounds: "5 أسئلة",
    playable: true,
  },
  noyes: {
    id: "noyes",
    world: "laugh",
    name: "ممنوع آه ولا لأ",
    kind: "ضحك",
    tagline: "جاوب بسرعة… من غير الكلمتين الممنوعين.",
    how: [
      "سؤال سريع وعدّاد بيجري عليكم إنتوا الاتنين.",
      "اكتب أي إجابة من غير «آه» أو «لأ» ومن غير ما تكرر إجابة قلتها.",
      "كل غلطة بقلب. اللي يفضل معاه قلوب أكتر يكسب.",
    ],
    mode: "versus",
    minutes: "3 دقايق",
    rounds: "7 أسئلة",
    playable: true,
  },
  draw: {
    id: "draw",
    world: "laugh",
    name: "خمن الرسمة",
    kind: "إبداع",
    tagline: "واحد يرسم والتاني يخمن… وبعدين تبدّلوا.",
    how: [
      "الرسّام يختار كلمة سرية من 3 كلمات.",
      "يرسمها على الشاشة والتاني يشوف الرسمة لحظة بلحظة ويكتب تخمينه.",
      "كل ما التخمين أسرع، النقاط أكتر للاتنين.",
    ],
    mode: "versus",
    minutes: "5 دقايق",
    rounds: "4 رسمات",
    playable: true,
  },
  envelope: {
    id: "envelope",
    world: "know",
    name: "الظرف المجهول",
    kind: "مفاجآت",
    tagline: "ظرف مقفول… وجواه سؤال مش متوقع.",
    how: [
      "افتحوا الظرف سوا عشان يظهر السؤال.",
      "كل واحد يجاوب براحته من غير ما التاني يشوف.",
      "الإجابات تتفتح مع بعض. مفيش صح وغلط — فيه اكتشاف.",
    ],
    mode: "coop",
    minutes: "5 دقايق",
    rounds: "4 أظرف",
    playable: true,
  },
  word: {
    id: "word",
    world: "brain",
    name: "أول كلمة",
    kind: "ذكاء",
    tagline: "نفس الموضوع… هل هتكتبوا نفس الكلمة؟",
    how: [
      "يظهر موضوع، وكل واحد يكتب أول كلمة تيجي في باله.",
      "قدامكم ثواني قليلة، فمتفكروش كتير.",
      "لو الكلمتين زي بعض أو قريبين، تكسبوا نقاط توافق سوا.",
    ],
    mode: "coop",
    minutes: "دقيقتين",
    rounds: "6 كلمات",
    playable: true,
  },
  minute: {
    id: "minute",
    world: "brain",
    name: "تحدي الدقيقة",
    kind: "ذكاء",
    tagline: "60 ثانية… واكتب أكبر عدد تقدر عليه.",
    how: [
      "يظهر تحدي زي «اكتبوا 10 حيوانات».",
      "كل واحد يكتب إجاباته على موبايله، وشايف عدّاد التاني بس.",
      "الإجابات اللي مش في القاموس يحكم عليها الطرف التاني.",
    ],
    mode: "versus",
    minutes: "3 دقايق",
    rounds: "تحديين",
    playable: true,
  },
  quick: {
    id: "quick",
    world: "know",
    name: "اختار بسرعة",
    kind: "تعارف",
    tagline: "اختيارين… ومفيش وقت للتفكير.",
    how: [],
    mode: "coop",
    minutes: "دقيقتين",
    rounds: "10 اختيارات",
    playable: false,
  },
  memory: {
    id: "memory",
    world: "brain",
    name: "لعبة الذاكرة",
    kind: "ذاكرة",
    tagline: "كروت مقلوبة… مين فاكر أكتر؟",
    how: [],
    mode: "versus",
    minutes: "4 دقايق",
    rounds: "لوحة واحدة",
    playable: false,
  },
  rps: {
    id: "rps",
    world: "versus",
    name: "حجر ورقة مقص",
    kind: "منافسة",
    tagline: "الاختيارين يظهروا في نفس اللحظة.",
    how: [],
    mode: "versus",
    minutes: "دقيقتين",
    rounds: "أول 3 نقاط",
    playable: false,
  },
  four: {
    id: "four",
    world: "versus",
    name: "أربعة على التوالي",
    kind: "استراتيجية",
    tagline: "أول واحد يصفّ أربعة يكسب.",
    how: [],
    mode: "versus",
    minutes: "5 دقايق",
    rounds: "لوحة مشتركة",
    playable: false,
  },
  secret: {
    id: "secret",
    world: "adventure",
    name: "الغرفة السرية",
    kind: "مغامرة",
    tagline: "أدلة مخفية… والباب ما يتفتحش غير بيكم الاتنين.",
    how: [],
    mode: "coop",
    minutes: "10 دقايق",
    rounds: "مراحل",
    playable: false,
  },
  words: {
    id: "words",
    world: "adventure",
    name: "رحلة الكلمات",
    kind: "ذكاء",
    tagline: "خريطة محطات… وفي آخرها كنز.",
    how: [],
    mode: "coop",
    minutes: "8 دقايق",
    rounds: "محطات",
    playable: false,
  },
};

export function worldOf(id: WorldId): World {
  const w = WORLDS.find((x) => x.id === id);
  if (!w) throw new Error(`unknown world ${id}`);
  return w;
}

/* ------------------------------------------------------------------ */
/*  DUWA Points                                                         */
/* ------------------------------------------------------------------ */
export const POINTS = {
  /** finishing a round together */
  complete: 5,
  /** extra for the round winner */
  win: 10,
  /** each player on a tie */
  tie: 5,
  /** extra for beating the game's hard challenge */
  hard: 15,
  /** co-op mission reached — goes to the shared balance */
  team: 20,
  /** a «رحلتنا» stage completed — shared balance */
  journey: 20,
} as const;

export interface Level {
  name: string;
  at: number;
}

export const LEVELS: Level[] = [
  { name: "البداية", at: 0 },
  { name: "الاكتشاف", at: 100 },
  { name: "المنافسة", at: 250 },
  { name: "المغامرة", at: 450 },
  { name: "العالم السري", at: 700 },
];

export interface LevelInfo {
  index: number;
  name: string;
  /** next thing to unlock, if any */
  next: { at: number; name: string; world: WorldId | null; remaining: number } | null;
  /** 0..1 progress from the current level to the next */
  progress: number;
}

export function levelInfo(shared: number): LevelInfo {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (shared >= LEVELS[i].at) index = i;
  const cur = LEVELS[index];
  const nxt = LEVELS[index + 1];
  if (!nxt) return { index, name: cur.name, next: null, progress: 1 };
  const world = WORLDS.find((w) => w.threshold === nxt.at) ?? null;
  return {
    index,
    name: cur.name,
    next: { at: nxt.at, name: world?.name ?? nxt.name, world: world?.id ?? null, remaining: nxt.at - shared },
    progress: (shared - cur.at) / (nxt.at - cur.at),
  };
}

export function worldUnlocked(world: World, shared: number, recorded: readonly string[] = []): boolean {
  return shared >= world.threshold || recorded.includes(world.id);
}
