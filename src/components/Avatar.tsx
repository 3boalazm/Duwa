import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { type AvatarId, colorHex } from "@/game/profile";

/**
 * DUWA avatars — a small hand-drawn set of characters.
 * Every character is painted with `currentColor`, so it takes the
 * player's chosen colour.
 */

const INK = "#0D0B1F";
const PAPER = "#F6F3FF";

function Eyes({ x1, x2, y, r = 3 }: { x1: number; x2: number; y: number; r?: number }) {
  return (
    <>
      <circle cx={x1} cy={y} r={r} fill={INK} />
      <circle cx={x2} cy={y} r={r} fill={INK} />
      <circle cx={x1 + r * 0.36} cy={y - r * 0.36} r={r * 0.34} fill="#fff" />
      <circle cx={x2 + r * 0.36} cy={y - r * 0.36} r={r * 0.34} fill="#fff" />
    </>
  );
}

function Smile({ x = 32, y, w = 7 }: { x?: number; y: number; w?: number }) {
  return (
    <path
      d={`M${x - w / 2} ${y} q${w / 2} ${w * 0.36} ${w} 0`}
      stroke={INK}
      strokeWidth="1.6"
      strokeLinecap="round"
      fill="none"
    />
  );
}

const ART: Record<AvatarId, ReactNode> = {
  cat: (
    <>
      <path d="M13 30 L15 10 L29 20 Z" fill="currentColor" />
      <path d="M51 30 L49 10 L35 20 Z" fill="currentColor" />
      <path d="M17.5 23.5 L18.4 15.4 L24.4 19.6 Z" fill="#fff" opacity=".38" />
      <path d="M46.5 23.5 L45.6 15.4 L39.6 19.6 Z" fill="#fff" opacity=".38" />
      <ellipse cx="32" cy="37" rx="20" ry="17.5" fill="currentColor" />
      <Eyes x1={24.5} x2={39.5} y={36} r={3.2} />
      <path d="M30.2 41.4 h3.6 l-1.8 2.2 Z" fill={INK} />
      <path d="M28 45.4 q2 1.8 4 0 q2 1.8 4 0" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path
        d="M12.5 40 h5.5 M13 44.6 l5.2 -1.2 M51.5 40 h-5.5 M51 44.6 l-5.2 -1.2"
        stroke={INK}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".5"
      />
    </>
  ),
  fox: (
    <>
      <path d="M12 30 L13 8 L28 20 Z" fill="currentColor" />
      <path d="M52 30 L51 8 L36 20 Z" fill="currentColor" />
      <path d="M16.4 23 L17 14 L23 19 Z" fill={INK} opacity=".3" />
      <path d="M47.6 23 L47 14 L41 19 Z" fill={INK} opacity=".3" />
      <path d="M11 28 Q32 14 53 28 Q50 44 32 57 Q14 44 11 28 Z" fill="currentColor" />
      <path d="M11 28 Q14 44 32 57 Q25 46 22 36 Q17 30 11 28 Z" fill="#fff" opacity=".9" />
      <path d="M53 28 Q50 44 32 57 Q39 46 42 36 Q47 30 53 28 Z" fill="#fff" opacity=".9" />
      <Eyes x1={24.5} x2={39.5} y={33.5} r={3} />
      <ellipse cx="32" cy="52.6" rx="3" ry="2.4" fill={INK} />
    </>
  ),
  bear: (
    <>
      <circle cx="16" cy="19" r="8" fill="currentColor" />
      <circle cx="48" cy="19" r="8" fill="currentColor" />
      <circle cx="16" cy="19" r="4" fill="#fff" opacity=".35" />
      <circle cx="48" cy="19" r="4" fill="#fff" opacity=".35" />
      <circle cx="32" cy="36" r="21" fill="currentColor" />
      <ellipse cx="32" cy="43.5" rx="9" ry="7" fill="#fff" opacity=".88" />
      <ellipse cx="32" cy="41" rx="3.4" ry="2.4" fill={INK} />
      <path d="M32 43.4 v2.2 M28.6 46.8 q3.4 2.4 6.8 0" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <Eyes x1={23.5} x2={40.5} y={33} r={2.8} />
    </>
  ),
  bunny: (
    <>
      <ellipse cx="23" cy="15" rx="5.5" ry="13" fill="currentColor" transform="rotate(-8 23 15)" />
      <ellipse cx="41" cy="15" rx="5.5" ry="13" fill="currentColor" transform="rotate(8 41 15)" />
      <ellipse cx="23" cy="16" rx="2.4" ry="8.5" fill="#fff" opacity=".42" transform="rotate(-8 23 16)" />
      <ellipse cx="41" cy="16" rx="2.4" ry="8.5" fill="#fff" opacity=".42" transform="rotate(8 41 16)" />
      <ellipse cx="32" cy="41" rx="19" ry="17" fill="currentColor" />
      <Eyes x1={25} x2={39} y={39} r={3} />
      <ellipse cx="32" cy="45.2" rx="2.2" ry="1.6" fill="#fff" opacity=".92" />
      <path d="M32 46.8 v1.8 M29 49.6 q3 2 6 0" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="19.5" cy="45.5" r="3" fill="#fff" opacity=".26" />
      <circle cx="44.5" cy="45.5" r="3" fill="#fff" opacity=".26" />
    </>
  ),
  panda: (
    <>
      <circle cx="15.5" cy="20" r="8" fill="currentColor" />
      <circle cx="48.5" cy="20" r="8" fill="currentColor" />
      <circle cx="32" cy="37" r="21" fill={PAPER} />
      <ellipse cx="23" cy="35" rx="6" ry="7.5" fill="currentColor" transform="rotate(18 23 35)" />
      <ellipse cx="41" cy="35" rx="6" ry="7.5" fill="currentColor" transform="rotate(-18 41 35)" />
      <Eyes x1={24} x2={40} y={35} r={2.6} />
      <ellipse cx="32" cy="44.5" rx="3.2" ry="2.2" fill={INK} />
      <Smile y={48.6} />
    </>
  ),
  owl: (
    <>
      <path d="M12 22 L14 8 L26 17 Z" fill="currentColor" />
      <path d="M52 22 L50 8 L38 17 Z" fill="currentColor" />
      <path
        d="M12 34 C12 20 22 14 32 14 C42 14 52 20 52 34 C52 48 43 57 32 57 C21 57 12 48 12 34 Z"
        fill="currentColor"
      />
      <path d="M22 45 q10 8 20 0 q-2 10.5 -10 10.5 q-8 0 -10 -10.5 Z" fill="#fff" opacity=".28" />
      <circle cx="23.5" cy="31" r="8.5" fill={PAPER} />
      <circle cx="40.5" cy="31" r="8.5" fill={PAPER} />
      <Eyes x1={24.5} x2={39.5} y={31.5} r={3.8} />
      <path d="M29 38.5 h6 l-3 5 Z" fill="#FFC65C" />
    </>
  ),
  robot: (
    <>
      <path d="M32 9 v7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="7.5" r="3.6" fill={PAPER} />
      <rect x="6.5" y="28" width="6" height="12" rx="3" fill="currentColor" opacity=".7" />
      <rect x="51.5" y="28" width="6" height="12" rx="3" fill="currentColor" opacity=".7" />
      <rect x="12" y="15" width="40" height="38" rx="11" fill="currentColor" />
      <rect x="17" y="23" width="30" height="15" rx="7.5" fill={INK} />
      <circle cx="25" cy="30.5" r="3.4" fill="#fff" />
      <circle cx="39" cy="30.5" r="3.4" fill="#fff" />
      <path d="M24.5 45 h15" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  alien: (
    <>
      <path d="M21 14 L17 6.5 M43 14 L47 6.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16.5" cy="5.8" r="3" fill="currentColor" />
      <circle cx="47.5" cy="5.8" r="3" fill="currentColor" />
      <path
        d="M10 30 C10 18 20 11 32 11 C44 11 54 18 54 30 C54 44 42 57 32 57 C22 57 10 44 10 30 Z"
        fill="currentColor"
      />
      <ellipse cx="22.5" cy="33" rx="6" ry="8.5" fill={INK} transform="rotate(24 22.5 33)" />
      <ellipse cx="41.5" cy="33" rx="6" ry="8.5" fill={INK} transform="rotate(-24 41.5 33)" />
      <circle cx="24.6" cy="30" r="1.9" fill="#fff" />
      <circle cx="39.6" cy="30" r="1.9" fill="#fff" />
      <Smile y={48} />
    </>
  ),
  ghost: (
    <>
      <path
        d="M12 32 C12 19 21 10 32 10 C43 10 52 19 52 32 V54 q-5 -6 -10 0 q-5 6 -10 0 q-5 -6 -10 0 q-5 6 -10 0 Z"
        fill="currentColor"
      />
      <ellipse cx="25" cy="30" rx="3.4" ry="4.6" fill={INK} />
      <ellipse cx="39" cy="30" rx="3.4" ry="4.6" fill={INK} />
      <circle cx="26.1" cy="28.4" r="1.2" fill="#fff" />
      <circle cx="40.1" cy="28.4" r="1.2" fill="#fff" />
      <ellipse cx="32" cy="41.5" rx="3.2" ry="3.8" fill={INK} />
      <circle cx="19" cy="38.5" r="2.8" fill="#fff" opacity=".28" />
      <circle cx="45" cy="38.5" r="2.8" fill="#fff" opacity=".28" />
    </>
  ),
  astro: (
    <>
      <rect x="6.5" y="29" width="7.5" height="13" rx="3.7" fill="currentColor" />
      <rect x="50" y="29" width="7.5" height="13" rx="3.7" fill="currentColor" />
      <circle cx="32" cy="35" r="22" fill={PAPER} />
      <rect x="15" y="23" width="34" height="24" rx="12" fill={INK} />
      <path d="M19.5 31 q2 -5 8 -5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <circle cx="26.5" cy="36" r="2.6" fill="currentColor" />
      <circle cx="38.5" cy="36" r="2.6" fill="currentColor" />
      <path d="M29 41.2 q3 2.2 6 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <circle cx="32" cy="10.5" r="2.8" fill="currentColor" />
    </>
  ),
  moon: (
    <>
      <path d="M30.05 12 A22 22 0 1 0 51.57 38.3 A17 17 0 0 1 30.05 12 Z" fill="currentColor" />
      <path d="M14.6 35.4 q3 -2.8 6 0" stroke={INK} strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <path d="M17.4 43.6 q4.2 3.2 8.2 0.4" stroke={INK} strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <circle cx="13.6" cy="41.2" r="2.4" fill="#fff" opacity=".3" />
      <path
        d="M46 14 C46.5 17.4 47.8 18.6 51 19 C47.8 19.4 46.5 20.6 46 24 C45.5 20.6 44.2 19.4 41 19 C44.2 18.6 45.5 17.4 46 14 Z"
        fill={PAPER}
      />
      <path
        d="M54.5 28.5 C54.8 30.2 55.4 30.8 57 31 C55.4 31.2 54.8 31.8 54.5 33.5 C54.2 31.8 53.6 31.2 52 31 C53.6 30.8 54.2 30.2 54.5 28.5 Z"
        fill={PAPER}
        opacity=".8"
      />
    </>
  ),
  planet: (
    <>
      <ellipse
        cx="32"
        cy="35"
        rx="27"
        ry="8.5"
        transform="rotate(-18 32 35)"
        stroke="#fff"
        strokeOpacity=".45"
        strokeWidth="3"
        fill="none"
      />
      <circle cx="32" cy="34" r="16.5" fill="currentColor" />
      <path
        d="M5 35 A27 8.5 0 0 0 59 35"
        transform="rotate(-18 32 35)"
        stroke={PAPER}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <Eyes x1={26.5} x2={37.5} y={30} r={2.5} />
      <Smile y={35.6} w={6} />
    </>
  ),
};

export function Avatar({
  avatar,
  color,
  size = 56,
  online,
  glow = false,
  className,
}: {
  avatar: string;
  color: string;
  size?: number;
  /** undefined = no status dot */
  online?: boolean;
  glow?: boolean;
  className?: string;
}) {
  const hex = colorHex(color);
  const art = ART[avatar as AvatarId] ?? ART.cat;
  const dot = Math.max(9, Math.round(size * 0.22));
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center rounded-full", className)}
      style={{
        width: size,
        height: size,
        color: hex,
        background: `radial-gradient(circle at 50% 30%, ${hex}3d, ${hex}14 72%)`,
        boxShadow: `inset 0 0 0 1.5px ${hex}70${glow ? `, 0 0 26px -4px ${hex}b0` : ""}`,
      }}
    >
      <svg viewBox="0 0 64 64" width={size * 0.76} height={size * 0.76} aria-hidden>
        {art}
      </svg>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 end-0 rounded-full border-2 border-midnight",
            online ? "bg-mint shadow-[0_0_8px_rgb(79_227_176/0.9)]" : "bg-dim",
          )}
          style={{ width: dot, height: dot }}
          aria-label={online ? "متصل" : "غير متصل"}
        />
      )}
    </span>
  );
}
