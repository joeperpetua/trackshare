export type RGB = [number, number, number];
type HSL = [number, number, number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function rgbToHsl([r, g, b]: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

export function hslToHex([h, s, l]: HSL): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)]
    .map((x) => Math.round(x * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Dark card background from the dominant cover color: lightness 12–20 %, saturation ≤ 55 %. */
export function darkBackground(dominant: RGB): string {
  const [h, s, l] = rgbToHsl(dominant);
  return hslToHex([h, Math.min(s, 0.55), 0.12 + clamp(l, 0, 1) * 0.08]);
}

/** Accent from the most vivid cover color: lightness 45–60 %. */
export function accent(vivid: RGB): string {
  const [h, s, l] = rgbToHsl(vivid);
  return hslToHex([h, Math.max(s, 0.35), clamp(l, 0.45, 0.6)]);
}

/** Pick a dominant and a vivid color from raw RGB pixels. */
export function palette(pixels: Uint8Array | Buffer, channels: number): { dominant: RGB; vivid: RGB } {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 2 < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  const colors = [...buckets.values()].map((c) => ({
    n: c.n,
    rgb: [c.r / c.n, c.g / c.n, c.b / c.n].map(Math.round) as RGB,
  }));
  if (colors.length === 0) return { dominant: [40, 40, 40], vivid: [217, 102, 59] };

  const dominant = colors.reduce((a, b) => (b.n > a.n ? b : a)).rgb;

  let vivid = dominant;
  let best = -1;
  for (const c of colors) {
    const [, s, l] = rgbToHsl(c.rgb);
    if (l < 0.2 || l > 0.85) continue;
    const score = s * Math.sqrt(c.n);
    if (score > best) {
      best = score;
      vivid = c.rgb;
    }
  }
  return { dominant, vivid };
}
