export const SHADE_NAMES = [
  50,
  100,
  200,
  300,
  400,
  500,
  600,
  700,
  800,
  900,
  950,
] as const;

export type Shade = (typeof SHADE_NAMES)[number];

export interface OklchColor {
  l: number;
  c: number;
  h: number;
}

export interface PaletteFamily {
  name: string;
  colors: Record<Shade, OklchColor>;
}

export interface GeneratedPalette {
  anchor: Shade;
  inferredAnchor: boolean;
  neighbors: readonly [string, string];
  colors: Record<Shade, OklchColor>;
}
