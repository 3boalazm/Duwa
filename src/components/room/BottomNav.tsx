"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, House, Route, Settings, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/home", label: "الرئيسية", icon: House },
  { href: "/worlds", label: "العوالم", icon: Gamepad2 },
  { href: "/journey", label: "رحلتنا", icon: Route },
  { href: "/achievements", label: "الإنجازات", icon: Trophy },
  { href: "/settings", label: "الإعدادات", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[460px] border-t border-line bg-midnight/85 px-2 pt-1.5 backdrop-blur-xl safe-b"
    >
      <ul className="flex items-stretch justify-between">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-cloud" : "text-dim hover:text-mist",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-12 place-items-center rounded-full transition-all duration-300",
                    active && "bg-violet/25 shadow-[0_0_18px_-2px_rgb(129_85_239/0.9)]",
                  )}
                >
                  <Icon className={cn("size-[21px]", active && "text-lavender")} strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
