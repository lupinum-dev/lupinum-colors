import { converter, differenceEuclidean } from "culori";
import {
  interpolateHue,
  normalizeHue,
  signedHueDelta,
} from "./color.js";
import { loadTailwindFamilies } from "./tailwind-data.js";
import {
  SHADE_NAMES,
  type GeneratedPalette,
  type OklchColor,
  type PaletteFamily,
  type Shade,
} from "./types.js";

const toOklab = converter("oklab");
const oklabDistance = differenceEuclidean("oklab");

interface Neighbors {
  left: PaletteFamily;
  right: PaletteFamily;
  amount: number;
}

export interface GenerateOptions {
  anchor?: Shade | "auto";
  families?: PaletteFamily[];
}

export function generatePalette(
  input: OklchColor,
  options: GenerateOptions = {},
): GeneratedPalette {
  const families = options.families ?? loadTailwindFamilies();
  if (families.length < 2) {
    throw new Error("At least two Tailwind palette families are required.");
  }

  const requestedAnchor = options.anchor ?? "auto";
  const inferredAnchor = requestedAnchor === "auto";
  const anchor: Shade = inferredAnchor
    ? inferAnchor(input, families)
    : requestedAnchor;
  const neighbors = findNeighbors(input.h, anchor, families);
  const anchorTemplate = interpolateTemplate(neighbors, anchor, anchor);
  const colors = {} as Record<Shade, OklchColor>;

  for (const shade of SHADE_NAMES) {
    if (shade === anchor) {
      colors[shade] = { ...input, h: normalizeHue(input.h) };
      continue;
    }

    const template = interpolateTemplate(neighbors, shade, anchor);
    const lightnessDelta = template.l - anchorTemplate.l;
    const lightness = scaleLightnessDelta(
      input.l,
      anchorTemplate.l,
      lightnessDelta,
    );
    const chromaRatio =
      anchorTemplate.c <= 1e-8 ? 0 : template.c / anchorTemplate.c;

    colors[shade] = {
      l: clamp(lightness, 0, 1),
      c: clamp(input.c * chromaRatio, 0, 0.5),
      h: normalizeHue(input.h + template.h),
    };
  }

  return {
    anchor,
    inferredAnchor,
    neighbors: [neighbors.left.name, neighbors.right.name],
    colors,
  };
}

export function inferAnchor(input: OklchColor, families: PaletteFamily[]): Shade {
  const inputLab = toOklab({ mode: "oklch", ...input });
  if (!inputLab) return 500;

  let bestShade: Shade = 500;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const family of families) {
    for (const shade of SHADE_NAMES) {
      const candidate = toOklab({ mode: "oklch", ...family.colors[shade] });
      if (!candidate) continue;
      const distance = oklabDistance(inputLab, candidate);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestShade = shade;
      }
    }
  }

  return bestShade;
}

function findNeighbors(
  hue: number,
  anchor: Shade,
  families: PaletteFamily[],
): Neighbors {
  const sorted = [...families].sort(
    (a, b) => a.colors[anchor].h - b.colors[anchor].h,
  );
  const normalizedHue = normalizeHue(hue);

  for (let index = 0; index < sorted.length; index += 1) {
    const left = sorted[index];
    const right = sorted[(index + 1) % sorted.length];
    const leftHue = left.colors[anchor].h;
    const arc = normalizeHue(right.colors[anchor].h - leftHue);
    const position = normalizeHue(normalizedHue - leftHue);

    if (position <= arc) {
      return {
        left,
        right,
        amount: arc <= 1e-8 ? 0 : position / arc,
      };
    }
  }

  throw new Error("Could not locate neighboring Tailwind hues.");
}

function interpolateTemplate(
  neighbors: Neighbors,
  shade: Shade,
  anchor: Shade,
): OklchColor {
  const leftColor = neighbors.left.colors[shade];
  const rightColor = neighbors.right.colors[shade];
  const leftAnchor = neighbors.left.colors[anchor];
  const rightAnchor = neighbors.right.colors[anchor];
  const amount = neighbors.amount;

  const leftHueDelta = signedHueDelta(leftAnchor.h, leftColor.h);
  const rightHueDelta = signedHueDelta(rightAnchor.h, rightColor.h);

  return {
    l: lerp(leftColor.l, rightColor.l, amount),
    c: lerp(leftColor.c, rightColor.c, amount),
    h: lerp(leftHueDelta, rightHueDelta, amount),
  };
}

function scaleLightnessDelta(
  inputLightness: number,
  templateAnchorLightness: number,
  delta: number,
): number {
  if (delta >= 0) {
    const available = Math.max(1 - templateAnchorLightness, 1e-8);
    return inputLightness + (delta / available) * (1 - inputLightness);
  }

  const available = Math.max(templateAnchorLightness, 1e-8);
  return inputLightness + (delta / available) * inputLightness;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
