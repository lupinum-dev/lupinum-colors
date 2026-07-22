import { inGamut } from "culori";
import { describe, expect, it } from "vitest";
import {
  formatHex,
  formatOklch,
  mapToGamut,
  parseColor,
  signedHueDelta,
} from "../src/color.js";

describe("color input and output", () => {
  it.each([
    "#89E5D2",
    "rgb(137 229 210)",
    "hsl(168 64% 72%)",
    "oklab(85.9% -0.0926 0.0039)",
    "oklch(85.9% 0.0927 179.25)",
    "color(display-p3 0.6 0.88 0.8)",
  ])("parses %s into finite OKLCH", (value) => {
    const parsed = parseColor(value);
    expect(parsed.oklch.l).toBeGreaterThanOrEqual(0);
    expect(parsed.oklch.l).toBeLessThanOrEqual(1);
    expect(parsed.oklch.c).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(parsed.oklch.h)).toBe(true);
  });

  it("round-trips the example hex", () => {
    const parsed = parseColor("#89E5D2");
    expect(formatHex(parsed.oklch)).toBe("#89e5d2");
  });

  it("formats achromatic hue as none", () => {
    expect(formatOklch({ l: 0.5, c: 0, h: 123 })).toBe("oklch(50% 0 none)");
  });

  it("maps excessive chroma without changing lightness or hue materially", () => {
    const source = { l: 0.7, c: 0.4, h: 200 };
    const mapped = mapToGamut(source, "srgb");
    expect(mapped.inGamut).toBe(false);
    expect(mapped.color.l).toBeCloseTo(source.l, 5);
    expect(Math.abs(signedHueDelta(mapped.color.h, source.h))).toBeLessThan(0.01);
    expect(mapped.color.c).toBeLessThan(source.c);
    expect(inGamut("rgb")({ mode: "oklch", ...mapped.color })).toBe(true);
  });

  it("supports Display P3 and raw gamut modes", () => {
    const source = { l: 0.7, c: 0.25, h: 145 };
    const p3 = mapToGamut(source, "display-p3");
    const raw = mapToGamut(source, "none");
    expect(inGamut("p3")({ mode: "oklch", ...p3.color })).toBe(true);
    expect(raw.color).toEqual(source);
    expect(raw.compression).toBe(0);
  });

  it("rejects malformed input", () => {
    expect(() => parseColor("mint-ish"))
      .toThrow(/Invalid color/);
  });
});
