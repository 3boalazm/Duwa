"use client";

import { useState } from "react";

const COLORS = ["#8155EF", "#B19AFF", "#5B6CFF", "#F2F0FA", "#FF6FB1", "#FFC65C", "#4FE3B0"];

interface Piece {
  left: number;
  delay: number;
  dx: number;
  rot: number;
  size: number;
  color: string;
  round: boolean;
}

/** A short, silent burst of confetti (the celebration is visual only). */
export function Confetti({ count = 36 }: { count?: number }) {
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.7,
      dx: (Math.random() - 0.5) * 160,
      rot: 240 + Math.random() * 720,
      size: 6 + Math.random() * 7,
      color: COLORS[i % COLORS.length],
      round: Math.random() < 0.35,
    })),
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[45] overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 animate-confetti"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 0.45,
              background: p.color,
              borderRadius: p.round ? "50%" : 2,
              animationDelay: `${p.delay}s`,
              opacity: 0,
              "--dx": `${p.dx}px`,
              "--rot": `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
