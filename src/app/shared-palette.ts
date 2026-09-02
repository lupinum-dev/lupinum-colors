import { loadTailwindFamilies } from '@/tailwind-data'
import {
  SHADE_NAMES,
  type Gamut,
  type OklchColor,
  type Palette,
  type SeedMode,
  type Shade,
} from '@/types'

export const SHARED_PALETTE_PREFIX = '#palette='
export const SHARED_PALETTE_MAX_LENGTH = 12_000
const KNOWN_HUE_PATHS = new Set([
  'balanced',
  ...loadTailwindFamilies().map((family) => family.name),
])

type ColorTuple = [lightness: number, chroma: number, hue: number]
type PaletteTuple = ColorTuple[]

export interface SharedPaletteV1 {
  v: 1
  r: [
    name: string,
    color: string,
    seed: SeedMode,
    anchor: Shade | 'auto',
    gamut: Gamut,
    huePath: string,
  ]
  b: PaletteTuple
  p: PaletteTuple
}

export class SharedPaletteError extends Error {}

export function encodeSharedPalette(payload: SharedPaletteV1): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const encoded = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  const hash = `${SHARED_PALETTE_PREFIX}${encoded}`
  if (hash.length > SHARED_PALETTE_MAX_LENGTH) {
    throw new SharedPaletteError('This palette is too large to store in a share link.')
  }
  return hash
}

export function decodeSharedPalette(hash: string): SharedPaletteV1 | null {
  if (!hash.startsWith(SHARED_PALETTE_PREFIX)) return null
  if (hash.length > SHARED_PALETTE_MAX_LENGTH) {
    throw new SharedPaletteError('This share link is too large to load safely.')
  }

  try {
    const encoded = hash
      .slice(SHARED_PALETTE_PREFIX.length)
      .replaceAll('-', '+')
      .replaceAll('_', '/')
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return validateSharedPalette(value)
  } catch (error) {
    if (error instanceof SharedPaletteError) throw error
    throw new SharedPaletteError('This share link is invalid or damaged.')
  }
}

export function paletteToTuple(palette: Palette): PaletteTuple {
  return SHADE_NAMES.map((shade) => {
    const color = palette[shade]
    return [color.l, color.c, color.h]
  })
}

export function tupleToPalette(tuple: PaletteTuple): Palette {
  return Object.fromEntries(
    SHADE_NAMES.map((shade, index) => {
      const [l, c, h] = tuple[index]!
      return [shade, { l, c, h } satisfies OklchColor]
    }),
  ) as Palette
}

function validateSharedPalette(value: unknown): SharedPaletteV1 {
  if (!isRecord(value) || value.v !== 1) {
    throw new SharedPaletteError('This share link uses an unsupported palette version.')
  }
  if (!Array.isArray(value.r) || value.r.length !== 6) {
    throw new SharedPaletteError('This share link is missing its generation settings.')
  }

  const [name, color, seed, anchor, gamut, huePath] = value.r
  if (typeof name !== 'string' || !/^\p{L}[\p{L}\p{N}-]*$/u.test(name) || name.length > 64) {
    throw new SharedPaletteError('This share link contains an invalid palette name.')
  }
  if (typeof color !== 'string' || color.length === 0 || color.length > 256) {
    throw new SharedPaletteError('This share link contains an invalid starting color.')
  }
  if (seed !== 'exact' && seed !== 'canonical') {
    throw new SharedPaletteError('This share link contains an invalid color-matching mode.')
  }
  if (anchor !== 'auto' && !SHADE_NAMES.includes(anchor as Shade)) {
    throw new SharedPaletteError('This share link contains an invalid anchor shade.')
  }
  if (gamut !== 'srgb' && gamut !== 'display-p3' && gamut !== 'none') {
    throw new SharedPaletteError('This share link contains an invalid display range.')
  }
  if (typeof huePath !== 'string' || !KNOWN_HUE_PATHS.has(huePath)) {
    throw new SharedPaletteError('This share link contains an invalid hue direction.')
  }

  return {
    v: 1,
    r: [name, color, seed, anchor as Shade | 'auto', gamut, huePath],
    b: validatePaletteTuple(value.b, 'generated baseline'),
    p: validatePaletteTuple(value.p, 'current palette'),
  }
}

function validatePaletteTuple(value: unknown, label: string): PaletteTuple {
  if (!Array.isArray(value) || value.length !== SHADE_NAMES.length) {
    throw new SharedPaletteError(`This share link contains an incomplete ${label}.`)
  }
  return value.map((entry) => {
    if (!Array.isArray(entry) || entry.length !== 3) {
      throw new SharedPaletteError(`This share link contains an invalid ${label}.`)
    }
    const [l, c, h] = entry
    if (![l, c, h].every((channel) => typeof channel === 'number' && Number.isFinite(channel))) {
      throw new SharedPaletteError(`This share link contains a non-numeric ${label}.`)
    }
    if (l < 0 || l > 1 || c < 0 || c > 1 || h < 0 || h > 360) {
      throw new SharedPaletteError(`This share link contains an out-of-range ${label}.`)
    }
    return [l, c, h]
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
