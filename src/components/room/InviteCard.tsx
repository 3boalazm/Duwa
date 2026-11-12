"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { copyText, inviteLink, shareInvite, whatsappLink } from "@/client/share";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/cn";

/** The invite code, big and easy to read out loud, plus ways to send it. */
export function InviteCard({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const copy = async (what: "code" | "link") => {
    const done = await copyText(what === "code" ? code : inviteLink(code));
    if (done) {
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    }
  };

  const share = async () => {
    if (!(await shareInvite(code))) await copy("link");
  };

  return (
    <div className={cn("card-glow p-5 text-center", className)}>
      <p className="text-[13px] text-mist">كود الدعوة</p>
      <button
        type="button"
        onClick={() => copy("code")}
        aria-label={`كود الدعوة ${code.split("").join(" ")} — اضغط للنسخ`}
        className="group mx-auto mt-2 flex items-center justify-center gap-3"
      >
        <span dir="ltr" className="font-latin text-[34px] font-extrabold tracking-[0.16em] text-gradient">
          {code}
        </span>
        <span className="grid size-9 place-items-center rounded-full bg-white/8 text-lavender transition-colors group-hover:bg-violet/30">
          {copied === "code" ? <Check className="size-4 text-mint" /> : <Copy className="size-4" />}
        </span>
      </button>
      <p className="mt-1 h-5 text-[12px] text-mint" aria-live="polite">
        {copied === "code" ? "اتنسخ الكود" : copied === "link" ? "اتنسخ الرابط" : ""}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <a href={whatsappLink(code)} target="_blank" rel="noopener noreferrer" className={buttonClass("soft", "md")}>
          <MessageCircle className="size-[18px] text-mint" />
          واتساب
        </a>
        <button type="button" onClick={share} className={buttonClass("soft", "md")}>
          <Share2 className="size-[18px] text-lavender" />
          مشاركة
        </button>
      </div>
    </div>
  );
}
