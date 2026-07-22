import assert from "node:assert/strict";
import test from "node:test";
import { converter, differenceEuclidean } from "culori";
import { signedHueDelta } from "../src/color.js";
import { generatePalette, inferAnchor } from "../src/palette.js";
import { loadTailwindFamilies } from "../src/tailwind-data.js";
import { SHADE_NAMES } from "../src/types.js";

const families = loadTailwindFamilies();
const toOklab = converter("oklab");
const oklabDistance = differenceEuclidean("oklab");

test("recognizes the supplied lime-300 anchor", () => {
  const lime = families.find((family) => family.name === "lime");
  assert.ok(lime);
  assert.equal(inferAnchor(lime.colors[300], families), 300);
});

test("reconstructs a known Tailwind family exactly from each explicit anchor", () => {
  for (const family of families) {
    for (const anchor of SHADE_NAMES) {
      const generated = generatePalette(family.colors[anchor], { anchor, families });
      for (const shade of SHADE_NAMES) {
        const expected = family.colors[shade];
        const actual = generated.colors[shade];
        assert.ok(Math.abs(actual.l - expected.l) < 1e-9, `${family.name}-${anchor} → ${shade} lightness`);
        assert.ok(Math.abs(actual.c - expected.c) < 1e-9, `${family.name}-${anchor} → ${shade} chroma`);
        assert.ok(Math.abs(signedHueDelta(actual.h, expected.h)) < 1e-9, `${family.name}-${anchor} → ${shade} hue`);
      }
    }
  }
});

test("keeps an arbitrary input exact and produces monotonic lightness", () => {
  const input = { l: 0.62, c: 0.19, h: 245 };
  const generated = generatePalette(input, { anchor: 500, families });
  assert.deepEqual(generated.colors[500], input);

  for (let index = 1; index < SHADE_NAMES.length; index += 1) {
    const lighter = generated.colors[SHADE_NAMES[index - 1]].l;
    const darker = generated.colors[SHADE_NAMES[index]].l;
    assert.ok(lighter > darker, `${SHADE_NAMES[index - 1]} should be lighter than ${SHADE_NAMES[index]}`);
  }
});

test("reconstructs held-out Tailwind families from their hue neighbors", () => {
  let totalError = 0;
  let worstFamilyError = 0;

  for (const target of families) {
    const trainingFamilies = families.filter((family) => family !== target);
    const generated = generatePalette(target.colors[500], {
      anchor: 500,
      families: trainingFamilies,
    });
    let familyError = 0;

    for (const shade of SHADE_NAMES) {
      const expected = toOklab({ mode: "oklch", ...target.colors[shade] });
      const actual = toOklab({ mode: "oklch", ...generated.colors[shade] });
      assert.ok(expected && actual);
      familyError += oklabDistance(expected, actual);
    }

    familyError /= SHADE_NAMES.length;
    totalError += familyError;
    worstFamilyError = Math.max(worstFamilyError, familyError);
  }

  const meanError = totalError / families.length;
  assert.ok(meanError < 0.02, `mean held-out error was ${meanError}`);
  assert.ok(worstFamilyError < 0.03, `worst held-out error was ${worstFamilyError}`);
});
