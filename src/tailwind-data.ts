import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseOklch } from "./color.js";
import { SHADE_NAMES, type OklchColor, type PaletteFamily, type Shade } from "./types.js";

const COLOR_DECLARATION =
  /--color-([a-z]+)-(50|100|200|300|400|500|600|700|800|900|950):\s*(oklch\([^)]+\))/g;

export function loadTailwindFamilies(): PaletteFamily[] {
  const themePath = fileURLToPath(import.meta.resolve("tailwindcss/theme.css"));
  const css = readFileSync(themePath, "utf8");
  const collected = new Map<string, Partial<Record<Shade, OklchColor>>>();

  for (const match of css.matchAll(COLOR_DECLARATION)) {
    const name = match[1];
    const shade = Number(match[2]) as Shade;
    const colors = collected.get(name) ?? {};
    colors[shade] = parseOklch(match[3]);
    collected.set(name, colors);
  }

  return [...collected.entries()]
    .filter(([, colors]) => SHADE_NAMES.every((shade) => colors[shade] !== undefined))
    .map(([name, colors]) => ({
      name,
      colors: colors as Record<Shade, OklchColor>,
    }))
    .filter((family) => Math.max(...SHADE_NAMES.map((shade) => family.colors[shade].c)) >= 0.05);
}
