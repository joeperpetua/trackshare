import { ImageResponse } from "next/og";
import { Card, CARD_SIZE } from "@/card/Card";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { type Cover, loadCover } from "./cover";
import { type CardTheme, paletteFor } from "./palette";
import { loadFonts } from "./fonts";
import type { MediaInfo } from "./types";

export interface RenderOptions {
  domain: string;
  locale?: Locale;
  theme?: CardTheme;
  /** Draws the badge that says the text is untouched service data. */
  verified?: boolean;
  /** Already downloaded cover, to save a second fetch. */
  cover?: Cover;
}

export async function renderCard(info: MediaInfo, options: RenderOptions): Promise<ImageResponse> {
  const { domain, locale = DEFAULT_LOCALE, theme = "auto", verified = true } = options;
  const [cover, fonts] = await Promise.all([options.cover ?? loadCover(info.coverUrl), loadFonts()]);
  return new ImageResponse(
    (
      <Card
        info={info}
        cover={cover.dataUri}
        palette={paletteFor(theme, cover)}
        domain={domain}
        labels={getDictionary(locale).card}
        verified={verified}
      />
    ),
    { width: CARD_SIZE, height: CARD_SIZE, fonts },
  );
}

export function slugify(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "card"
  );
}
