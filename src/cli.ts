#!/usr/bin/env node
import { formatOklch, parseOklch } from "./color.js";
import { generatePalette } from "./palette.js";
import { SHADE_NAMES, type Shade } from "./types.js";

type OutputFormat = "table" | "json" | "css";

interface CliOptions {
  name: string;
  color: string;
  anchor: Shade | "auto";
  format: OutputFormat;
}

function parseArguments(args: string[]): CliOptions {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const positional: string[] = [];
  let anchor: Shade | "auto" = "auto";
  let format: OutputFormat = "table";

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--at") {
      const value = args[++index];
      if (value === "auto") {
        anchor = "auto";
      } else {
        const shade = Number(value) as Shade;
        if (!SHADE_NAMES.includes(shade)) {
          throw new Error(`--at must be auto or one of: ${SHADE_NAMES.join(", ")}`);
        }
        anchor = shade;
      }
    } else if (argument === "--format") {
      const value = args[++index] as OutputFormat;
      if (!["table", "json", "css"].includes(value)) {
        throw new Error("--format must be table, json, or css");
      }
      format = value;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
  }

  if (positional.length !== 2) {
    throw new Error("Expected a palette name and one quoted OKLCH color.");
  }

  return { name: positional[0], color: positional[1], anchor, format };
}

function printHelp(): void {
  console.log(`tw-palette — generate a Tailwind-style OKLCH palette

Usage:
  tw-palette <name> <oklch-color> [--at auto|SHADE] [--format table|json|css]

Examples:
  tw-palette primary "oklch(89.7% 0.196 126.665)" --at 300
  tw-palette brand "oklch(62% 0.19 245)" --format css`);
}

function printResult(options: CliOptions): void {
  const input = parseOklch(options.color);
  const result = generatePalette(input, { anchor: options.anchor });
  const entries = SHADE_NAMES.map((shade) => [shade, formatOklch(result.colors[shade])] as const);

  if (options.format === "json") {
    console.log(JSON.stringify({
      name: options.name,
      anchor: result.anchor,
      inferredAnchor: result.inferredAnchor,
      neighbors: result.neighbors,
      colors: Object.fromEntries(entries),
    }, null, 2));
    return;
  }

  if (options.format === "css") {
    console.log(":root {");
    for (const [shade, color] of entries) {
      console.log(`  --color-${options.name}-${shade}: ${color};`);
    }
    console.log("}");
    return;
  }

  console.log(`${options.name} (anchor: ${result.anchor}${result.inferredAnchor ? ", inferred" : ""}; hue templates: ${result.neighbors.join(" → ")})`);
  console.table(Object.fromEntries(entries.map(([shade, color]) => [shade, color])));
}

try {
  printResult(parseArguments(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
