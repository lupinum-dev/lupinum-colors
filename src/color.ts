import type { OklchColor } from "./types.js";

const OKLCH_PATTERN =
  /^oklch\(\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))(%?)\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s+(none|[+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:deg)?(?:\s*\/\s*[^)]+)?\s*\)$/i;

export function parseOklch(input: string): OklchColor {
  const match = input.trim().match(OKLCH_PATTERN);
  if (!match) {
    throw new Error(
      `Invalid color "${input}". Expected oklch(<lightness> <chroma> <hue>), for example oklch(63.7% 0.237 25.331).`,
    );
  }

  const lightness = Number(match[1]) / (match[2] === "%" ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = match[4].toLowerCase() === "none" ? 0 : Number(match[4]);

  if (!Number.isFinite(lightness) || lightness < 0 || lightness > 1) {
    throw new Error("OKLCH lightness must be between 0 and 1 (or 0% and 100%).");
  }
  if (!Number.isFinite(chroma) || chroma < 0) {
    throw new Error("OKLCH chroma must be a non-negative number.");
  }
  if (!Number.isFinite(hue)) {
    throw new Error("OKLCH hue must be a finite number or none.");
  }

  return { l: lightness, c: chroma, h: normalizeHue(hue) };
}

export function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

export function signedHueDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function interpolateHue(from: number, to: number, amount: number): number {
  return normalizeHue(from + signedHueDelta(from, to) * amount);
}

function trim(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, "");
}

export function formatOklch(color: OklchColor): string {
  return `oklch(${trim(color.l * 100, 3)}% ${trim(color.c, 4)} ${trim(normalizeHue(color.h), 3)})`;
}
