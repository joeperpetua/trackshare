import { readFile } from "node:fs/promises";
import path from "node:path";

type Weight = 500 | 700 | 800;
export interface SatoriFont {
  name: string;
  data: Buffer;
  weight: Weight;
  style: "normal";
}

const dir = (pkg: string) => path.join(process.cwd(), "node_modules", "@fontsource", pkg, "files");

interface FamilyDef {
  name: string;
  pkg: string;
  weights: Weight[];
  subsets: string[];
}

const FAMILIES: FamilyDef[] = [
  {
    name: "Bricolage Grotesque",
    pkg: "bricolage-grotesque",
    weights: [500, 700, 800],
    subsets: ["latin", "latin-ext", "vietnamese"],
  },
  {
    name: "Inter Tight",
    pkg: "inter-tight",
    weights: [500, 700],
    subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek", "greek-ext", "vietnamese"],
  },
  {
    name: "JetBrains Mono",
    pkg: "jetbrains-mono",
    weights: [500],
    subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek", "vietnamese"],
  },
];

const FILES = FAMILIES.flatMap((family) =>
  family.weights.flatMap((weight) =>
    family.subsets.map((subset) => ({
      name: family.name,
      weight,
      file: path.join(dir(family.pkg), `${family.pkg}-${subset}-${weight}-normal.woff`),
    })),
  ),
);

let fonts: Promise<SatoriFont[]> | null = null;

/** Load the card fonts once per server process. Satori needs TTF, OTF or WOFF (not WOFF2). */
export function loadFonts(): Promise<SatoriFont[]> {
  fonts ??= Promise.all(
    FILES.map(async (f) => ({
      name: f.name,
      weight: f.weight,
      style: "normal" as const,
      data: await readFile(f.file),
    })),
  ).catch((err) => {
    fonts = null;
    throw err;
  });
  return fonts;
}
