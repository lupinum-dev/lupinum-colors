export const SHADE_NAMES = Object.freeze([
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const)

export type Shade = (typeof SHADE_NAMES)[number]
export type SeedMode = 'exact' | 'canonical'
export type Gamut = 'srgb' | 'display-p3' | 'none'
export type OutputFormat = 'table' | 'json' | 'css' | 'tailwind'

export interface OklchColor {
  l: number
  c: number
  h: number
}

export type Palette = Record<Shade, OklchColor>
export type ReadonlyPalette = {
  readonly [shade in Shade]: Readonly<OklchColor>
}

export interface ParsedColor {
  original: string
  oklch: OklchColor
  alpha: number
}

export interface PaletteFamily {
  readonly name: string
  readonly colors: ReadonlyPalette
  readonly kind: 'chromatic' | 'neutral'
}

export interface TailwindReference {
  readonly tailwindVersion: string
  readonly sourceSha256: string
  readonly shades: readonly Shade[]
  readonly families: readonly PaletteFamily[]
}

export interface AnchorCandidate {
  shade: Shade
  confidence: number
  distance: number
}

export interface ShadeResult {
  raw: OklchColor
  mapped: OklchColor
  css: string
  hex?: string
  inGamut: boolean
  gamutCompression: number
  deltaFromPrevious?: number
  contrastOnWhite: number
  contrastOnBlack: number
}

export interface DisplayShade extends ShadeResult {
  shade: Shade
}

export interface PaletteMeasurements {
  lightnessMonotonic: boolean
  maximumHueJump: number
  minimumAdjacentDelta: number
}

export interface PaletteEvaluation extends PaletteMeasurements {
  shades: Record<Shade, ShadeResult>
}

export interface PaletteRequest {
  name: string
  color: string | OklchColor
  seed?: SeedMode
  anchor?: Shade | 'auto'
  huePath?: string
  gamut?: Gamut
}

export interface PaletteResult {
  name: string
  input: ParsedColor
  configuration: {
    seed: SeedMode
    anchor: Shade
    anchorWasInferred: boolean
    anchorConfidence?: number
    anchorCandidates?: AnchorCandidate[]
    huePath: string
    gamut: Gamut
  }
  reference: {
    tailwindVersion: string
    model: 'periodic-cubic-v1' | 'neutral-temperature-v1'
    identityHue: number
    neighbors: readonly [string, string]
    kind: 'chromatic' | 'neutral'
  }
  shades: Record<Shade, ShadeResult>
  diagnostics: PaletteMeasurements & {
    constraintsSatisfied: boolean
    warnings: string[]
  }
}
