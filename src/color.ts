import {
  clampChroma,
  converter,
  differenceEuclidean,
  formatHex as culoriFormatHex,
  inGamut,
  parse,
  wcagContrast,
  type Color,
} from "culori";
import type { Gamut, OklchColor, ParsedColor } from "./types.js";

const toOklch = converter("oklch");
const toOklab = converter("oklab");
const oklabDistance = differenceEuclidean("oklab");

export function parseColor(input: string | OklchColor): ParsedColor {
  if (typeof input !== "string") {
    validateOklch(input);
    return {
      original: formatOklch(input),
      oklch: { ...input, h: normalizeHue(input.h) },
      alpha: 1,
    };
  }

  const parsed = parse(input.trim());
  const converted = parsed ? toOklch(parsed) : undefined;
  if (!parsed || !converted) {
    throw new Error(
      `Invalid color "${input}". Use hex, rgb(), hsl(), oklab(), oklch(), or color(display-p3 ...).`,
    );
  }

  const color: OklchColor = {
    l: converted.l,
    c: converted.c ?? 0,
    h: normalizeHue(converted.h ?? 0),
  };
  validateOklch(color);

  return {
    original: input,
    oklch: color,
    alpha: parsed.alpha ?? 1,
  };
}

export function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

export function signedHueDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function circularHueDistance(first: number, second: number): number {
  return Math.abs(signedHueDelta(first, second));
}

export function formatOklch(color: OklchColor): string {
  const hue = color.c < 1e-7 ? "none" : trim(normalizeHue(color.h), 3);
  return `oklch(${trim(color.l * 100, 3)}% ${trim(color.c, 4)} ${hue})`;
}

export function formatHex(color: OklchColor): string {
  return culoriFormatHex(asCulori(color));
}

export function perceptualDistance(first: OklchColor, second: OklchColor): number {
  const firstLab = toOklab(asCulori(first));
  const secondLab = toOklab(asCulori(second));
  if (!firstLab || !secondLab) return Number.POSITIVE_INFINITY;
  return oklabDistance(firstLab, secondLab);
}

export function mapToGamut(
  color: OklchColor,
  gamut: Gamut,
): { color: OklchColor; inGamut: boolean; compression: number } {
  if (gamut === "none") {
    return { color: { ...color }, inGamut: true, compression: 0 };
  }

  const mode = gamut === "srgb" ? "rgb" : "p3";
  const source = asCulori(color);
  const sourceIsInGamut = inGamut(mode)(source);
  if (sourceIsInGamut) {
    return { color: { ...color }, inGamut: true, compression: 0 };
  }

  const clamped = clampChroma(source, "oklch", mode);
  const converted = toOklch(clamped);
  const mapped: OklchColor = {
    l: converted?.l ?? color.l,
    c: converted?.c ?? 0,
    h: normalizeHue(converted?.h ?? color.h),
  };

  return {
    color: mapped,
    inGamut: false,
    compression: Math.max(0, color.c - mapped.c),
  };
}

export function contrastRatios(color: OklchColor): {
  onWhite: number;
  onBlack: number;
} {
  const value = asCulori(color);
  return {
    onWhite: wcagContrast(value, "white"),
    onBlack: wcagContrast(value, "black"),
  };
}

function asCulori(color: OklchColor): Color {
  return { mode: "oklch", l: color.l, c: color.c, h: color.h };
}

function validateOklch(color: OklchColor): void {
  if (!Number.isFinite(color.l) || color.l < 0 || color.l > 1) {
    throw new Error("OKLCH lightness must be between 0 and 1.");
  }
  if (!Number.isFinite(color.c) || color.c < 0) {
    throw new Error("OKLCH chroma must be a non-negative number.");
  }
  if (!Number.isFinite(color.h)) {
    throw new Error("OKLCH hue must be finite.");
  }
}

function trim(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, "");
}
