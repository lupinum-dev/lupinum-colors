import { generatePalette, generateVariants } from "./palette.js";
import {
  SHADE_NAMES,
  type Gamut,
  type OutputFormat,
  type PaletteRequest,
  type PaletteResult,
  type SeedMode,
  type Shade,
} from "./types.js";

interface CliOptions extends PaletteRequest {
  format: OutputFormat;
  variants: boolean;
  inspect: boolean;
  explain: boolean;
}

export function parseArguments(args: string[]): CliOptions {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const positional: string[] = [];
  let seed: SeedMode = "exact";
  let anchor: Shade | "auto" | undefined;
  let huePath = "balanced";
  let gamut: Gamut = "srgb";
  let format: OutputFormat = "table";
  let variants = false;
  let inspect = false;
  let explain = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--seed") {
      seed = takeChoice(args, ++index, "--seed", ["exact", "canonical"]);
    } else if (argument === "--at") {
      const value = takeValue(args, ++index, "--at");
      if (value === "auto") anchor = "auto";
      else {
        const shade = Number(value) as Shade;
        if (!SHADE_NAMES.includes(shade)) {
          throw new Error(`--at must be auto or one of: ${SHADE_NAMES.join(", ")}`);
        }
        anchor = shade;
      }
    } else if (argument === "--hue-path") {
      huePath = takeValue(args, ++index, "--hue-path");
    } else if (argument === "--gamut") {
      gamut = takeChoice(args, ++index, "--gamut", ["srgb", "display-p3", "none"]);
    } else if (argument === "--format") {
      format = takeChoice(args, ++index, "--format", ["table", "json", "css", "tailwind"]);
    } else if (argument === "--variants") {
      variants = true;
    } else if (argument === "--inspect") {
      inspect = true;
    } else if (argument === "--explain") {
      explain = true;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
  }

  if (positional.length !== 2) {
    throw new Error("Expected a palette name and one quoted color. Run with --help for examples.");
  }

  return {
    name: positional[0],
    color: positional[1],
    seed,
    anchor,
    huePath,
    gamut,
    format,
    variants,
    inspect,
    explain,
  };
}

function printHelp(): void {
  console.log(`tw-palette — Tailwind-calibrated color shade generator

Usage:
  tw-palette <name> <color> [options]

Options:
  --seed exact|canonical       Preserve the input, or use it as family identity
  --at auto|SHADE              Anchor shade (exact defaults auto; canonical defaults 500)
  --hue-path PATH              balanced or a reported neighboring family name
  --variants                   Generate balanced and both neighboring hue paths
  --gamut srgb|display-p3|none Output gamut (default: srgb)
  --format table|json|css|tailwind
  --inspect                    Include per-shade quality metrics in the table
  --explain                    Explain inference and generation decisions
  -h, --help                   Show this help

Examples:
  tw-palette primary "#89E5D2" --seed exact --at auto --explain
  tw-palette primary "#89E5D2" --seed canonical --at 500 --variants
  tw-palette brand "oklch(62% 0.19 245)" --format tailwind`);
}

export function runCli(options: CliOptions): PaletteResult[] {
  const request: PaletteRequest = {
    name: options.name,
    color: options.color,
    seed: options.seed,
    anchor: options.anchor,
    huePath: options.huePath,
    gamut: options.gamut,
  };
  const results = options.variants
    ? generateVariants(request)
    : [generatePalette(request)];

  if (options.format === "json") {
    console.log(JSON.stringify(options.variants ? results : results[0], null, 2));
    return results;
  }

  results.forEach((result, index) => {
    if (index > 0) console.log("");
    if (options.explain) printExplanation(result);
    printResult(result, options.format, options.inspect);
  });
  return results;
}

function printResult(
  result: PaletteResult,
  format: OutputFormat,
  inspect: boolean,
): void {
  if (format === "css" || format === "tailwind") {
    const opening = format === "tailwind" ? "@theme {" : ":root {";
    console.log(`/* hue path: ${result.configuration.huePath} */`);
    console.log(opening);
    for (const shade of SHADE_NAMES) {
      console.log(`  --color-${result.name}-${shade}: ${result.shades[shade].css};`);
    }
    console.log("}");
    return;
  }

  console.log(
    `${result.name} — ${result.configuration.seed} seed, anchor ${result.configuration.anchor}${result.configuration.anchorWasInferred ? " (inferred)" : ""}, ${result.configuration.huePath} hue path`,
  );
  const rows = Object.fromEntries(SHADE_NAMES.map((shade) => {
    const value = result.shades[shade];
    return [shade, inspect ? {
      OKLCH: value.css,
      Hex: value.hex ?? "—",
      "ΔE prev": value.deltaFromPrevious?.toFixed(4) ?? "—",
      "Contrast W": value.contrastOnWhite.toFixed(2),
      "Contrast B": value.contrastOnBlack.toFixed(2),
      Gamut: value.inGamut ? "in" : `mapped -${value.gamutCompression.toFixed(4)}C`,
    } : {
      OKLCH: value.css,
      Hex: value.hex ?? "—",
    }];
  }));
  console.table(rows);
}

function printExplanation(result: PaletteResult): void {
  const confidence = result.configuration.anchorConfidence;
  console.log(`Input: ${result.input.original}`);
  console.log(`Parsed: ${result.input.oklch.l.toFixed(4)} L, ${result.input.oklch.c.toFixed(4)} C, ${result.input.oklch.h.toFixed(2)}° H`);
  console.log(`Reference: Tailwind ${result.reference.tailwindVersion}, ${result.reference.kind}, ${result.reference.model}`);
  console.log(`Hue neighbors: ${result.reference.neighbors.join(" → ")}`);
  if (confidence !== undefined) {
    console.log(`Natural anchor: ${result.configuration.anchor} (${(confidence * 100).toFixed(1)}% confidence)`);
    const alternatives = result.configuration.anchorCandidates?.slice(1)
      .map((candidate) => `${candidate.shade} ${(candidate.confidence * 100).toFixed(1)}%`)
      .join(", ");
    if (alternatives) console.log(`Alternatives: ${alternatives}`);
  }
  for (const warning of result.diagnostics.warnings) console.log(`Warning: ${warning}`);
}

function takeValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value.`);
  return value;
}

function takeChoice<T extends string>(
  args: string[],
  index: number,
  option: string,
  choices: readonly T[],
): T {
  const value = takeValue(args, index, option);
  if (!choices.includes(value as T)) {
    throw new Error(`${option} must be one of: ${choices.join(", ")}`);
  }
  return value as T;
}
