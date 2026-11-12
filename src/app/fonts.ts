import localFont from "next/font/local";

/**
 * Self-hosted variable fonts (SIL OFL 1.1 — see src/fonts/LICENSE.md).
 * Arabic and Latin subsets are separate files; the browser falls back
 * glyph-by-glyph in the order of the font-family stack.
 */
export const readexArabic = localFont({
  src: "../fonts/ReadexPro-Arabic.woff2",
  weight: "160 700",
  variable: "--font-readex-ar",
  display: "swap",
});

export const readexLatin = localFont({
  src: "../fonts/ReadexPro-Latin.woff2",
  weight: "160 700",
  variable: "--font-readex-lat",
  display: "swap",
});

export const alexandria = localFont({
  src: "../fonts/Alexandria-Arabic.woff2",
  weight: "100 900",
  variable: "--font-alexandria",
  display: "swap",
});

export const unbounded = localFont({
  src: "../fonts/Unbounded-Latin.woff2",
  weight: "200 900",
  variable: "--font-unbounded",
  display: "swap",
});

export const fontVariables = [readexArabic.variable, readexLatin.variable, alexandria.variable, unbounded.variable].join(" ");
