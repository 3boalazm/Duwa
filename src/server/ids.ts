import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

/** No look-alike characters (0/O, 1/I/L) so codes are easy to read out loud. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export const ROOM_CODE_LENGTH = 6;
export const RECOVERY_CODE_LENGTH = 8;

export const newRoomCode = () => randomCode(ROOM_CODE_LENGTH);
export const newRecoveryCode = () => randomCode(RECOVERY_CODE_LENGTH);
export const newToken = () => randomBytes(32).toString("base64url");
export const newId = () => randomUUID();

/** Secrets are stored hashed; `salt` binds the hash to its room/player. */
export function hashSecret(secret: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${secret}`).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Cryptographically strong uniform random in [0, 1). */
export function secureRandom(): number {
  return randomInt(0x1000000) / 0x1000000;
}
