import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/*  Button                                                              */
/* ------------------------------------------------------------------ */
type ButtonVariant = "primary" | "soft" | "ghost" | "danger" | "outline";
type ButtonSize = "lg" | "md" | "sm";

const BTN_BASE =
  "relative inline-flex select-none items-center justify-center gap-2 font-semibold transition-[transform,filter,background-color,box-shadow,opacity] duration-200 active:scale-[0.975] disabled:opacity-45 disabled:active:scale-100";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "text-white bg-[linear-gradient(135deg,#9670ff_0%,#7a4df0_48%,#5b6cff_100%)] shadow-[0_0_0_1px_rgb(177_154_255/0.35)_inset,0_12px_34px_-12px_rgb(129_85_239/0.95)] hover:brightness-110",
  soft: "text-cloud bg-navy-2 border border-line-2 hover:bg-navy-3",
  outline: "text-lavender border border-line-2 bg-transparent hover:bg-violet/10",
  ghost: "text-lavender hover:bg-violet/10",
  danger: "text-rose border border-rose/40 bg-rose/10 hover:bg-rose/15",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  lg: "h-14 px-6 text-[17px] rounded-2xl",
  md: "h-12 px-5 text-[15px] rounded-[14px]",
  sm: "h-9 px-3.5 text-[13px] rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "lg",
  block,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], block && "w-full", className)}
      {...rest}
    >
      {loading ? <Dots /> : children}
    </button>
  );
}

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "lg", block = false) {
  return cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], block && "w-full");
}

/* ------------------------------------------------------------------ */
/*  Small pieces                                                        */
/* ------------------------------------------------------------------ */
export function Dots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label="جاري التحميل">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-current animate-dots"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

type ChipTone = "violet" | "mint" | "amber" | "rose" | "muted";
const CHIP_TONE: Record<ChipTone, string> = {
  violet: "text-lavender bg-violet/15 border-violet/40",
  mint: "text-mint bg-mint/10 border-mint/35",
  amber: "text-amber bg-amber/10 border-amber/35",
  rose: "text-rose bg-rose/10 border-rose/35",
  muted: "text-mist bg-white/5 border-line",
};

export function Chip({
  tone = "violet",
  className,
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium leading-5 whitespace-nowrap",
        CHIP_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  className,
  tone = "violet",
}: {
  /** 0..1 */
  value: number;
  className?: string;
  tone?: "violet" | "mint" | "amber";
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fill =
    tone === "mint"
      ? "bg-[linear-gradient(90deg,#2fc892,#4fe3b0)]"
      : tone === "amber"
        ? "bg-[linear-gradient(90deg,#ffab3d,#ffc65c)]"
        : "bg-[linear-gradient(90deg,#5b6cff,#8155ef_45%,#b19aff)]";
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-white/8", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Progress grows from the reading-start edge (right in RTL). */}
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out shadow-[0_0_12px_rgb(129_85_239/0.8)]", fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)}>
      <h2 className="text-[17px] font-bold text-cloud">{children}</h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fields                                                              */
/* ------------------------------------------------------------------ */
export function TextField({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-14 w-full rounded-2xl border border-line-2 bg-midnight/70 px-4 text-[16px] text-cloud placeholder:text-dim outline-none transition-[border-color,box-shadow] duration-200 focus:border-violet focus:shadow-[0_0_0_4px_rgb(129_85_239/0.22)]",
        className,
      )}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Layout shells                                                       */
/* ------------------------------------------------------------------ */
/** Phone-width column used by every screen. */
export function Screen({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto flex screen-h w-full max-w-[460px] flex-col px-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function Notice({
  tone = "violet",
  children,
  className,
}: {
  tone?: "violet" | "rose" | "amber" | "mint";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    violet: "border-violet/40 bg-violet/10 text-lavender",
    rose: "border-rose/40 bg-rose/10 text-rose",
    amber: "border-amber/40 bg-amber/10 text-amber",
    mint: "border-mint/40 bg-mint/10 text-mint",
  } as const;
  return (
    <div role="status" className={cn("rounded-2xl border px-4 py-3 text-[14px] leading-6", tones[tone], className)}>
      {children}
    </div>
  );
}
