import referenceJson from "../reference/tailwind-colors.generated.json" with { type: "json" };
import { SHADE_NAMES, type PaletteFamily, type TailwindReference } from "./types.js";

let cachedReference: TailwindReference | undefined;

export function loadTailwindReference(): TailwindReference {
  if (cachedReference) return cachedReference;

  const parsed = referenceJson as unknown as TailwindReference;

  if (!parsed.tailwindVersion || !parsed.sourceSha256) {
    throw new Error("Tailwind reference metadata is incomplete.");
  }
  if (parsed.shades.join(",") !== SHADE_NAMES.join(",")) {
    throw new Error("Tailwind reference shade set does not match the generator.");
  }
  for (const family of parsed.families) {
    if (!SHADE_NAMES.every((shade) => family.colors[shade])) {
      throw new Error(`Tailwind reference family ${family.name} is incomplete.`);
    }
  }

  cachedReference = parsed;
  return parsed;
}

export function loadTailwindFamilies(
  kind?: PaletteFamily["kind"],
): PaletteFamily[] {
  const families = loadTailwindReference().families;
  return kind ? families.filter((family) => family.kind === kind) : families;
}
