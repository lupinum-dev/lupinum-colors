import {
  circularHueDistance,
  contrastRatios,
  formatHex,
  formatOklch,
  mapToGamut,
  normalizeHue,
  parseColor,
  perceptualDistance,
  signedHueDelta,
} from "./color.js";
import { loadTailwindFamilies, loadTailwindReference } from "./tailwind-data.js";
import {
  SHADE_NAMES,
  type AnchorCandidate,
  type OklchColor,
  type PaletteFamily,
  type PaletteRequest,
  type PaletteResult,
  type Shade,
} from "./types.js";

const NEUTRAL_CANONICAL_THRESHOLD = 0.02;
const CONFIDENCE_TEMPERATURE = 0.025;

// Cross-validated against every held-out Tailwind family. Shade 50 deliberately
// favors worst-case control; other anchors minimize mean error with a worst-case
// penalty. These are model coefficients, not user-facing configuration.
const TANGENT_SCALES: Record<Shade, { l: number; c: number; h: number }> = {
  50: { l: 2.5, c: 2.5, h: 2 },
  100: { l: 1.5, c: 3, h: 0.5 },
  200: { l: 1.5, c: 3, h: 1 },
  300: { l: 1, c: 3, h: 0 },
  400: { l: 1, c: 1.5, h: 0 },
  500: { l: 0.5, c: 2.5, h: 0 },
  600: { l: 3, c: 2.5, h: 0 },
  700: { l: 3, c: 1.5, h: 0 },
  800: { l: 3, c: 1.5, h: 0 },
  900: { l: 3, c: 2, h: 0 },
  950: { l: 2, c: 3, h: 0 },
};

interface Neighbors {
  previous: PaletteFamily;
  left: PaletteFamily;
  right: PaletteFamily;
  next: PaletteFamily;
  amount: number;
  previousArc: number;
  arc: number;
  nextArc: number;
}

export function generatePalette(request: PaletteRequest): PaletteResult {
  validateName(request.name);
  const input = parseColor(request.color);
  const seed = request.seed ?? "exact";
  const requestedAnchor = request.anchor ?? (seed === "canonical" ? 500 : "auto");
  const gamut = request.gamut ?? "srgb";
  const allFamilies = request.families ?? loadTailwindFamilies();
  const kind = chooseKind(input.oklch, seed, allFamilies);
  const families = allFamilies.filter((family) => family.kind === kind);
  if (families.length === 0) {
    throw new Error(`No ${kind} Tailwind reference families are available.`);
  }

  const anchorCandidates = inferAnchor(input.oklch, families);
  const anchorWasInferred = requestedAnchor === "auto";
  const anchor = anchorWasInferred ? anchorCandidates[0].shade : requestedAnchor;
  const warnings: string[] = [];

  if (input.alpha !== 1) {
    warnings.push(`Input alpha ${round(input.alpha, 3)} was ignored; palette tokens are opaque.`);
  }
  if (!anchorWasInferred && seed === "exact" && anchorCandidates[0].shade !== anchor) {
    warnings.push(
      `The input naturally resembles shade ${anchorCandidates[0].shade}, but was explicitly placed at ${anchor}.`,
    );
  }

  const { template, neighbors, huePath } = kind === "chromatic"
    ? buildChromaticTemplate(input.oklch.h, anchor, families, request.huePath ?? "balanced")
    : buildNeutralTemplate(input.oklch, anchor, families, request.huePath ?? "balanced");
  const rawColors = seed === "exact"
    ? anchorTemplate(template, input.oklch, anchor)
    : template;
  const shades = {} as PaletteResult["shades"];

  let previous: OklchColor | undefined;
  let maximumHueJump = 0;
  let minimumAdjacentDelta = Number.POSITIVE_INFINITY;
  let compressedShades = 0;

  for (const shade of SHADE_NAMES) {
    const raw = rawColors[shade];
    const mapped = mapToGamut(raw, gamut);
    const contrasts = contrastRatios(mapped.color);
    const deltaFromPrevious = previous
      ? perceptualDistance(previous, mapped.color)
      : undefined;

    if (previous) {
      maximumHueJump = Math.max(
        maximumHueJump,
        circularHueDistance(previous.h, mapped.color.h),
      );
      minimumAdjacentDelta = Math.min(
        minimumAdjacentDelta,
        deltaFromPrevious ?? Number.POSITIVE_INFINITY,
      );
    }
    if (!mapped.inGamut) compressedShades += 1;

    shades[shade] = {
      raw,
      mapped: mapped.color,
      css: formatOklch(mapped.color),
      hex: gamut === "srgb" ? formatHex(mapped.color) : undefined,
      inGamut: mapped.inGamut,
      gamutCompression: mapped.compression,
      deltaFromPrevious,
      contrastOnWhite: contrasts.onWhite,
      contrastOnBlack: contrasts.onBlack,
    };
    previous = mapped.color;
  }

  if (compressedShades > 0) {
    warnings.push(`${compressedShades} shade${compressedShades === 1 ? " was" : "s were"} chroma-mapped to ${gamut}.`);
  }

  const lightnessMonotonic = SHADE_NAMES.every((shade, index) =>
    index === 0 || rawColors[SHADE_NAMES[index - 1]].l > rawColors[shade].l
  );
  if (!lightnessMonotonic) {
    warnings.push(
      "Strict lightness ordering is impossible for this anchor at its extreme lightness; choose auto placement or canonical mode.",
    );
  }
  if (minimumAdjacentDelta < 0.01) {
    warnings.push(
      `The smallest adjacent OKLab distance is ${round(minimumAdjacentDelta, 4)}; some shades may be difficult to distinguish.`,
    );
  }
  if (seed === "exact" && !shades[anchor].inGamut) {
    warnings.push(
      "The exact anchor is preserved in raw OKLCH, but its displayed value was mapped into the requested gamut.",
    );
  }

  return {
    name: request.name,
    input,
    configuration: {
      seed,
      anchor,
      anchorWasInferred,
      anchorConfidence: anchorWasInferred ? anchorCandidates[0].confidence : undefined,
      anchorCandidates: anchorWasInferred ? anchorCandidates.slice(0, 3) : undefined,
      huePath,
      gamut,
    },
    reference: {
      tailwindVersion: loadTailwindReference().tailwindVersion,
      model: kind === "chromatic" ? "periodic-cubic-v1" : "neutral-temperature-v1",
      identityHue: rawColors[500].h,
      neighbors: [neighbors.left.name, neighbors.right.name],
      kind,
    },
    shades,
    diagnostics: {
      lightnessMonotonic,
      maximumHueJump,
      minimumAdjacentDelta,
      constraintsSatisfied: lightnessMonotonic,
      warnings,
    },
  };
}

export function generateVariants(
  request: Omit<PaletteRequest, "huePath">,
): PaletteResult[] {
  const balanced = generatePalette({ ...request, huePath: "balanced" });
  if (balanced.reference.kind === "neutral") return [balanced];

  const [left, right] = balanced.reference.neighbors;
  return [
    balanced,
    generatePalette({ ...request, huePath: left }),
    generatePalette({ ...request, huePath: right }),
  ];
}

export function inferAnchor(
  input: OklchColor,
  families: PaletteFamily[] = loadTailwindFamilies("chromatic"),
): AnchorCandidate[] {
  const candidates = SHADE_NAMES.map((shade) => {
    const relevant = families.filter((family) => family.kind === families[0]?.kind);
    let expected: OklchColor;

    if (relevant[0]?.kind === "neutral") {
      const family = findClosestNeutral(input, shade, relevant);
      expected = family.colors[shade];
    } else {
      const neighbors = findNeighbors(input.h, shade, relevant);
      expected = {
        l: lerp(
          neighbors.left.colors[shade].l,
          neighbors.right.colors[shade].l,
          neighbors.amount,
        ),
        c: lerp(
          neighbors.left.colors[shade].c,
          neighbors.right.colors[shade].c,
          neighbors.amount,
        ),
        h: input.h,
      };
    }

    return {
      shade,
      distance: perceptualDistance(input, expected),
      confidence: 0,
    };
  }).sort((first, second) => first.distance - second.distance);

  const best = candidates[0].distance;
  const weights = candidates.map((candidate) =>
    Math.exp(-(candidate.distance - best) / CONFIDENCE_TEMPERATURE)
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  candidates.forEach((candidate, index) => {
    candidate.confidence = weights[index] / total;
  });
  return candidates;
}

function buildChromaticTemplate(
  inputHue: number,
  anchor: Shade,
  families: PaletteFamily[],
  requestedHuePath: string,
): {
  template: Record<Shade, OklchColor>;
  neighbors: Neighbors;
  huePath: string;
} {
  const neighbors = findNeighbors(inputHue, anchor, families);
  const allowed = ["balanced", neighbors.left.name, neighbors.right.name];
  if (!allowed.includes(requestedHuePath)) {
    throw new Error(
      `Hue path "${requestedHuePath}" is unavailable. Choose ${allowed.join(", ")}.`,
    );
  }

  const template = {} as Record<Shade, OklchColor>;
  for (const shade of SHADE_NAMES) {
    const relative = interpolateTemplateColor(
      neighbors,
      shade,
      anchor,
      requestedHuePath,
    );
    template[shade] = {
      l: relative.l,
      c: relative.c,
      h: normalizeHue(inputHue + relative.h),
    };
  }

  return { template, neighbors, huePath: requestedHuePath };
}

function buildNeutralTemplate(
  input: OklchColor,
  anchor: Shade,
  families: PaletteFamily[],
  requestedHuePath: string,
): {
  template: Record<Shade, OklchColor>;
  neighbors: Neighbors;
  huePath: string;
} {
  if (requestedHuePath !== "balanced") {
    throw new Error("Neutral palettes only support the balanced hue path.");
  }
  const tintedFamilies = families.filter(
    (family) => family.colors[anchor].c >= 0.001,
  );
  if (input.c >= 0.001 && tintedFamilies.length >= 2) {
    const neighbors = findNeighbors(input.h, anchor, tintedFamilies);
    const template = {} as Record<Shade, OklchColor>;
    for (const shade of SHADE_NAMES) {
      const leftColor = neighbors.left.colors[shade];
      const rightColor = neighbors.right.colors[shade];
      const leftAnchor = neighbors.left.colors[anchor];
      const rightAnchor = neighbors.right.colors[anchor];
      const hueDelta = lerp(
        signedHueDelta(leftAnchor.h, leftColor.h),
        signedHueDelta(rightAnchor.h, rightColor.h),
        neighbors.amount,
      );
      template[shade] = {
        l: lerp(leftColor.l, rightColor.l, neighbors.amount),
        c: lerp(leftColor.c, rightColor.c, neighbors.amount),
        h: normalizeHue(input.h + hueDelta),
      };
    }
    return { template, neighbors, huePath: "balanced" };
  }

  const family = families.find((candidate) => candidate.name === "neutral")
    ?? findClosestNeutral(input, anchor, families);
  return {
    template: cloneColors(family.colors),
    neighbors: {
      previous: family,
      left: family,
      right: family,
      next: family,
      amount: 0,
      previousArc: 1,
      arc: 1,
      nextArc: 1,
    },
    huePath: "balanced",
  };
}

function anchorTemplate(
  template: Record<Shade, OklchColor>,
  input: OklchColor,
  anchor: Shade,
): Record<Shade, OklchColor> {
  const anchored = {} as Record<Shade, OklchColor>;
  const referenceAnchor = template[anchor];

  for (const shade of SHADE_NAMES) {
    if (shade === anchor) {
      anchored[shade] = { ...input, h: normalizeHue(input.h) };
      continue;
    }

    const reference = template[shade];
    const lightnessDelta = reference.l - referenceAnchor.l;
    const chromaRatio = referenceAnchor.c <= 1e-8
      ? 0
      : reference.c / referenceAnchor.c;
    anchored[shade] = {
      l: clamp(scaleLightnessDelta(input.l, referenceAnchor.l, lightnessDelta), 0, 1),
      c: Math.max(0, input.c * chromaRatio),
      h: normalizeHue(input.h + signedHueDelta(referenceAnchor.h, reference.h)),
    };
  }
  return anchored;
}

function chooseKind(
  input: OklchColor,
  seed: "exact" | "canonical",
  families: PaletteFamily[],
): PaletteFamily["kind"] {
  const chromatic = families.filter((family) => family.kind === "chromatic");
  const neutral = families.filter((family) => family.kind === "neutral");
  if (neutral.length === 0) return "chromatic";
  if (chromatic.length === 0) return "neutral";
  if (seed === "canonical") {
    return input.c < NEUTRAL_CANONICAL_THRESHOLD ? "neutral" : "chromatic";
  }

  const chromaticDistance = minimumReferenceDistance(input, chromatic);
  const neutralDistance = minimumReferenceDistance(input, neutral);
  return neutralDistance < chromaticDistance ? "neutral" : "chromatic";
}

function minimumReferenceDistance(input: OklchColor, families: PaletteFamily[]): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (const family of families) {
    for (const shade of SHADE_NAMES) {
      minimum = Math.min(minimum, perceptualDistance(input, family.colors[shade]));
    }
  }
  return minimum;
}

function findClosestNeutral(
  input: OklchColor,
  shade: Shade,
  families: PaletteFamily[],
): PaletteFamily {
  return [...families].sort(
    (first, second) =>
      perceptualDistance(input, first.colors[shade]) -
      perceptualDistance(input, second.colors[shade]),
  )[0];
}

function findNeighbors(
  hue: number,
  anchor: Shade,
  families: PaletteFamily[],
): Neighbors {
  if (families.length < 2) {
    throw new Error("At least two chromatic Tailwind families are required.");
  }
  const sorted = [...families].sort(
    (first, second) => first.colors[anchor].h - second.colors[anchor].h,
  );
  const normalizedHue = normalizeHue(hue);

  for (let index = 0; index < sorted.length; index += 1) {
    const left = sorted[index];
    const right = sorted[(index + 1) % sorted.length];
    const leftHue = left.colors[anchor].h;
    const arc = normalizeHue(right.colors[anchor].h - leftHue);
    const position = normalizeHue(normalizedHue - leftHue);
    if (position <= arc) {
      const previous = sorted[(index - 1 + sorted.length) % sorted.length];
      const next = sorted[(index + 2) % sorted.length];
      return {
        previous,
        left,
        right,
        next,
        amount: arc <= 1e-8 ? 0 : position / arc,
        previousArc: normalizeHue(leftHue - previous.colors[anchor].h),
        arc,
        nextArc: normalizeHue(next.colors[anchor].h - right.colors[anchor].h),
      };
    }
  }
  throw new Error("Could not locate neighboring Tailwind hues.");
}

function interpolateTemplateColor(
  neighbors: Neighbors,
  shade: Shade,
  anchor: Shade,
  huePath: string,
): OklchColor {
  const leftColor = neighbors.left.colors[shade];
  const rightColor = neighbors.right.colors[shade];
  const leftAnchor = neighbors.left.colors[anchor];
  const rightAnchor = neighbors.right.colors[anchor];
  const leftHueDelta = signedHueDelta(leftAnchor.h, leftColor.h);
  const rightHueDelta = signedHueDelta(rightAnchor.h, rightColor.h);
  const scales = TANGENT_SCALES[anchor];

  let hueDelta: number;
  if (huePath === neighbors.left.name) hueDelta = leftHueDelta;
  else if (huePath === neighbors.right.name) hueDelta = rightHueDelta;
  else {
    hueDelta = interpolatePeriodic(
      neighbors,
      (family) => signedHueDelta(
        family.colors[anchor].h,
        family.colors[shade].h,
      ),
      scales.h,
    );
  }

  return {
    l: interpolatePeriodic(neighbors, (family) => family.colors[shade].l, scales.l),
    c: Math.max(0, interpolatePeriodic(neighbors, (family) => family.colors[shade].c, scales.c)),
    h: hueDelta,
  };
}

function interpolatePeriodic(
  neighbors: Neighbors,
  value: (family: PaletteFamily) => number,
  tangentScale: number,
): number {
  const y0 = value(neighbors.previous);
  const y1 = value(neighbors.left);
  const y2 = value(neighbors.right);
  const y3 = value(neighbors.next);
  const segment = Math.max(neighbors.arc, 1e-8);
  const x0 = -Math.max(neighbors.previousArc, 1e-8);
  const x1 = 0;
  const x2 = segment;
  const x3 = segment + Math.max(neighbors.nextArc, 1e-8);
  const tangent1 = ((y2 - y0) / (x2 - x0)) * tangentScale;
  const tangent2 = ((y3 - y1) / (x3 - x1)) * tangentScale;
  const t = neighbors.amount;
  const t2 = t * t;
  const t3 = t2 * t;
  const result =
    (2 * t3 - 3 * t2 + 1) * y1 +
    (t3 - 2 * t2 + t) * segment * tangent1 +
    (-2 * t3 + 3 * t2) * y2 +
    (t3 - t2) * segment * tangent2;

  // Prevent spline overshoot between sparse, art-directed hue families.
  return clamp(result, Math.min(y1, y2), Math.max(y1, y2));
}

function scaleLightnessDelta(
  inputLightness: number,
  referenceAnchorLightness: number,
  delta: number,
): number {
  if (delta >= 0) {
    const available = Math.max(1 - referenceAnchorLightness, 1e-8);
    return inputLightness + (delta / available) * (1 - inputLightness);
  }
  const available = Math.max(referenceAnchorLightness, 1e-8);
  return inputLightness + (delta / available) * inputLightness;
}

function cloneColors(colors: Record<Shade, OklchColor>): Record<Shade, OklchColor> {
  return Object.fromEntries(
    SHADE_NAMES.map((shade) => [shade, { ...colors[shade] }]),
  ) as Record<Shade, OklchColor>;
}

function validateName(name: string): void {
  if (!/^[a-z][a-z0-9-]*$/i.test(name)) {
    throw new Error("Palette name must start with a letter and contain only letters, numbers, or hyphens.");
  }
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
