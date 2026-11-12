import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * DUWA mark — two orbits, one shared universe.
 * Two interlocking rings (the two players); the bright lens where they
 * overlap is the private universe they share.
 */
export function LogoMark({ size = 64, className }: { size?: number; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="DUWA"
    >
      <defs>
        <linearGradient id={`${id}a`} x1="9" y1="16" x2="38" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A283FF" />
          <stop offset="1" stopColor="#6A3FE8" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="26" y1="14" x2="56" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E3D9FF" />
          <stop offset="1" stopColor="#8E9BFF" />
        </linearGradient>
        <radialGradient id={`${id}c`} cx="32" cy="32" r="13" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#D9CCFF" />
          <stop offset="1" stopColor="#8155EF" />
        </radialGradient>
      </defs>
      <circle cx="25" cy="32" r="15.5" stroke={`url(#${id}a)`} strokeWidth="5" />
      <circle cx="39" cy="32" r="15.5" stroke={`url(#${id}b)`} strokeWidth="5" />
      {/* over-under weave so the rings read as linked */}
      <path d="M36 43 A15.5 15.5 0 0 1 25.5 47.49" stroke={`url(#${id}a)`} strokeWidth="5" />
      <path
        d="M32 21.05 A13 13 0 0 1 32 42.95 A13 13 0 0 1 32 21.05 Z"
        fill={`url(#${id}c)`}
      />
    </svg>
  );
}

/** Mark with ambient glow + orbiting sparks, used on hero screens. */
export function LogoHero({ size = 132 }: { size?: number }) {
  return (
    <div className="relative grid place-items-center" style={{ width: size * 1.7, height: size * 1.45 }}>
      <div
        className="absolute rounded-full animate-breathe"
        style={{
          width: size * 1.25,
          height: size * 1.25,
          background: "radial-gradient(closest-side, rgb(129 85 239 / 0.55), rgb(129 85 239 / 0.12) 60%, transparent)",
          filter: "blur(6px)",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 animate-orbit" aria-hidden>
        <span className="absolute start-[8%] top-[22%] size-1.5 rounded-full bg-lavender shadow-[0_0_12px_2px_rgb(177_154_255/0.9)]" />
        <span className="absolute end-[10%] bottom-[18%] size-1 rounded-full bg-cloud shadow-[0_0_10px_2px_rgb(242_240_250/0.8)]" />
      </div>
      <LogoMark size={size} className="relative drop-shadow-[0_8px_28px_rgb(129_85_239/0.65)] animate-float" />
    </div>
  );
}

export function Wordmark({ className, size = "lg" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "text-[17px] tracking-[0.16em]",
    md: "text-2xl tracking-[0.18em]",
    lg: "text-[44px] tracking-[0.16em]",
  } as const;
  return (
    <span dir="ltr" className={cn("font-latin font-extrabold leading-none text-cloud", sizes[size], className)}>
      DUWA
    </span>
  );
}

export function BrandRow({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={26} />
      <Wordmark size="sm" />
    </span>
  );
}
