import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const DECLARATION =
  /--color-([a-z]+)-(50|100|200|300|400|500|600|700|800|900|950):\s*oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+(none|[\d.]+)\s*\)/g;

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const themePath = fileURLToPath(import.meta.resolve("tailwindcss/theme.css"));
const packagePath = resolve(dirname(themePath), "package.json");
const outputPath = resolve(projectRoot, "reference/tailwind-colors.generated.json");

const css = readFileSync(themePath, "utf8");
const tailwindPackage = JSON.parse(readFileSync(packagePath, "utf8")) as {
  version: string;
};
const collected = new Map<string, Record<string, { l: number; c: number; h: number }>>();

for (const match of css.matchAll(DECLARATION)) {
  const [, name, shade, lightness, percent, chroma, hue] = match;
  const colors = collected.get(name) ?? {};
  colors[shade] = {
    l: Number(lightness) / (percent === "%" ? 100 : 1),
    c: Number(chroma),
    h: hue === "none" ? 0 : Number(hue),
  };
  collected.set(name, colors);
}

const families = [...collected.entries()]
  .filter(([, colors]) => SHADES.every((shade) => colors[String(shade)]))
  .map(([name, colors]) => ({
    name,
    kind: Math.max(...SHADES.map((shade) => colors[String(shade)].c)) >= 0.05
      ? "chromatic"
      : "neutral",
    colors,
  }));

if (families.length < 20) {
  throw new Error(`Expected at least 20 complete Tailwind families, found ${families.length}.`);
}

const reference = {
  tailwindVersion: tailwindPackage.version,
  sourceSha256: createHash("sha256").update(css).digest("hex"),
  shades: SHADES,
  families,
};
const output = `${JSON.stringify(reference, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const existing = readFileSync(outputPath, "utf8");
  if (existing !== output) {
    throw new Error("Tailwind reference is stale. Run npm run reference:build.");
  }
  console.log(`Reference verified: Tailwind ${reference.tailwindVersion}, ${families.length} families.`);
} else {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output);
  console.log(`Wrote Tailwind ${reference.tailwindVersion} reference with ${families.length} families.`);
}
