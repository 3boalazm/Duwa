/** Copy with a fallback for embedded previews where the Clipboard API is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const done = document.execCommand("copy");
    area.remove();
    return done;
  } catch {
    return false;
  }
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/?code=${code}`;
}

export function inviteMessage(code: string): string {
  return `تعالى نلعب سوا على دُوّا 🎮\nكود الغرفة: ${code}\n${inviteLink(code)}`;
}

export function whatsappLink(code: string): string {
  return `https://wa.me/?text=${encodeURIComponent(inviteMessage(code))}`;
}

/** Native share sheet when the device has one. Returns false when unavailable. */
export async function shareInvite(code: string): Promise<boolean> {
  if (typeof navigator.share !== "function") return false;
  try {
    await navigator.share({ title: "DUWA | دُوّا", text: inviteMessage(code) });
    return true;
  } catch {
    return true; // the user closed the sheet: nothing else to do
  }
}

export function relativeTime(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "من لحظات";
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? "من دقيقة" : m === 2 ? "من دقيقتين" : m <= 10 ? `من ${m} دقايق` : `من ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "من ساعة" : h === 2 ? "من ساعتين" : h <= 10 ? `من ${h} ساعات` : `من ${h} ساعة`;
  const d = Math.round(h / 24);
  return d === 1 ? "إمبارح" : d === 2 ? "من يومين" : d <= 10 ? `من ${d} أيام` : `من ${d} يوم`;
}
