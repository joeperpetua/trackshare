import { hslToHex, rgbToHsl, type RGB } from "./color";
import type { Cover } from "./cover";

export const CARD_THEMES = ["auto", "light", "dark"] as const;

export type CardTheme = (typeof CARD_THEMES)[number];

export interface Palette {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  /** Hairline color for rules and borders. */
  rule: string;
  /** True when the background is light, so the card needs dark text. */
  isLight: boolean;
}

export function isCardTheme(value: unknown): value is CardTheme {
  return typeof value === "string" && (CARD_THEMES as readonly string[]).includes(value);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const FIXED: Record<"light" | "dark", Palette> = {
  light: {
    background: "#f4f1ea",
    foreground: "#141414",
    muted: "rgba(20,20,20,0.64)",
    accent: "#141414",
    rule: "rgba(20,20,20,0.26)",
    isLight: true,
  },
  dark: {
    background: "#111013",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.72)",
    accent: "#ffffff",
    rule: "rgba(255,255,255,0.28)",
    isLight: false,
  },
};

/** Accent from the most vivid cover color: lightness 45-60 %. */
function accentFrom(vivid: RGB): string {
  const [h, s, l] = rgbToHsl(vivid);
  return hslToHex([h, Math.max(s, 0.35), clamp(l, 0.45, 0.6)]);
}

/** A light cover gets a light card, anything else a dark one. */
function fromCover(dominant: RGB, vivid: RGB): Palette {
  const [h, s, l] = rgbToHsl(dominant);
  const accent = accentFrom(vivid);
  if (l > 0.62) {
    const foreground = hslToHex([h, Math.min(s, 0.4), 0.1]);
    return {
      background: hslToHex([h, Math.min(s, 0.55) * 0.7, clamp(l, 0.84, 0.9)]),
      foreground,
      muted: withAlpha(foreground, 0.66),
      accent,
      rule: withAlpha(foreground, 0.26),
      isLight: true,
    };
  }
  return {
    background: hslToHex([h, Math.min(s, 0.55), 0.12 + clamp(l, 0, 1) * 0.08]),
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.72)",
    accent,
    rule: "rgba(255,255,255,0.28)",
    isLight: false,
  };
}

export function paletteFor(theme: CardTheme, cover: Pick<Cover, "dominant" | "vivid">): Palette {
  if (theme === "auto") return fromCover(cover.dominant, cover.vivid);
  return { ...FIXED[theme], accent: accentFrom(cover.vivid) };
}
