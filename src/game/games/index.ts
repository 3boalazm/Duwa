import type { PlayableGameId } from "../catalog";
import { draw } from "./draw";
import { envelope } from "./envelope";
import { guess } from "./guess";
import { minute } from "./minute";
import type { GameModule } from "./module";
import { noyes } from "./noyes";
import { word } from "./word";

export const MODULES: Record<PlayableGameId, GameModule> = { guess, noyes, draw, envelope, word, minute };
