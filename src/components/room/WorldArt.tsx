import { Lock } from "lucide-react";
import type { World } from "@/game/catalog";
import { cn } from "@/lib/cn";
import { WORLD_ICON } from "./icons";

/** A small "planet" for a world: its two-colour glow plus an icon. */
export function WorldOrb({ world, locked, size = 56 }: { world: World; locked?: boolean; size?: number }) {
  const Icon = WORLD_ICON[world.id];
  const [a, b] = world.hue;
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center rounded-full", locked && "grayscale-[0.7] opacity-70")}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 28%, ${a}, ${b} 62%, #17132b 118%)`,
        boxShadow: locked ? "inset 0 0 0 1px rgb(255 255 255 / 0.12)" : `0 8px 26px -8px ${b}, inset 0 0 0 1px rgb(255 255 255 / 0.22)`,
      }}
    >
      {locked ? (
        <Lock className="text-white/90" style={{ width: size * 0.4, height: size * 0.4 }} strokeWidth={2.2} />
      ) : (
        <Icon className="text-white drop-shadow" style={{ width: size * 0.46, height: size * 0.46 }} strokeWidth={2} />
      )}
    </span>
  );
}
