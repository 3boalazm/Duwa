/** JSON shapes shared between the API routes and the browser. Types only. */
import type { GameId, WorldId } from "@/game/catalog";
import type { SessionView } from "@/game/engine";
import type { Profile } from "@/game/profile";
import type { AchievementRecord, Flash, LastRound, PlayerStats, Seat, SessionResult } from "@/game/types";

export interface PeekResult {
  state: "open" | "full" | "missing";
  /** The player already waiting in the room (shown to the joiner). */
  host?: Pick<Profile, "name" | "gender" | "avatar" | "color" | "title">;
}

export interface PlayerView {
  seat: Seat;
  name: string;
  gender: "m" | "f";
  avatar: string;
  color: string;
  title: string;
  points: number;
  online: boolean;
  stats: PlayerStats;
}

/** Everything one player may know about the room right now. */
export interface RoomView {
  code: string;
  me: PlayerView;
  partner: PlayerView | null;
  /** the pair's shared DUWA Points — this is what opens worlds */
  shared: number;
  unlocked: WorldId[];
  plays: Partial<Record<GameId, number>>;
  sessions: number;
  /** completed «رحلتنا» stages */
  journey: number;
  achievements: AchievementRecord[];
  last: LastRound | null;
  flash: Flash | null;
  session: SessionView | null;
}

export interface SyncResponse {
  /** room version: changes whenever anything in the room changes */
  v: number;
  /** server clock (epoch ms) so both phones count down in step */
  now: number;
  /** omitted when nothing changed since the version the client already has */
  view?: RoomView;
  partnerOnline?: boolean;
}

export interface EnterResponse extends SyncResponse {
  view: RoomView;
  creds: { pid: string; token: string; code: string; recovery?: string };
}

export type ClientAction =
  | { type: "propose"; gameId: string }
  | { type: "respond"; accept: boolean }
  | { type: "leave" }
  | { type: "next" }
  | { type: "play"; move: Record<string, unknown> }
  | { type: "profile"; profile: unknown }
  | { type: "rotate_code" }
  | { type: "new_recovery" }
  | { type: "delete_me" };

export interface ActResponse extends SyncResponse {
  view: RoomView;
  /** set by actions that create a new secret */
  recovery?: string;
  /** set when the account was deleted */
  gone?: boolean;
}

export interface HistoryResponse {
  items: Array<Omit<SessionResult, "log">>;
}

export interface StrokeBatch {
  seq: number;
  ops: unknown[];
}

export interface DrawResponse {
  batches: StrokeBatch[];
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
