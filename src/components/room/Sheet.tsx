"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Bottom sheet / dialog. Closes on Escape or backdrop tap when `onClose` is given. */
export function Sheet({
  open,
  onClose,
  children,
  labelledBy,
  className,
}: {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  labelledBy?: string;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button
        type="button"
        aria-label="إغلاق"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-midnight/75 backdrop-blur-sm animate-fade"
      />
      <div
        className={cn(
          "relative w-full max-w-[460px] animate-sheet rounded-t-[28px] border border-b-0 border-line-2 bg-navy px-5 pt-3 shadow-[0_-20px_60px_-20px_rgb(129_85_239/0.55)] safe-b sm:rounded-[28px] sm:border-b",
          className,
        )}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" aria-hidden />
        {children}
      </div>
    </div>
  );
}
