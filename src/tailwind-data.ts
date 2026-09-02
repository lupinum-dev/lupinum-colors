import referenceJson from '../reference/tailwind-colors.generated.json' with { type: 'json' }
import {
  SHADE_NAMES,
  type OklchColor,
  type Palette,
  type PaletteFamily,
  type TailwindReference,
} from './types.js'

let cachedReference: TailwindReference | undefined

export function loadTailwindReference(): TailwindReference {
  cachedReference ??= parseReference(referenceJson)
  return cachedReference
}

export function loadTailwindFamilies(kind?: PaletteFamily['kind']): readonly PaletteFamily[] {
  const families = loadTailwindReference().families
  return kind ? families.filter((family) => family.kind === kind) : families
}

function parseReference(value: unknown): TailwindReference {
  if (!isRecord(value)) throw invalidReference('root value must be an object')

  const { tailwindVersion, sourceSha256, shades, families } = value
  if (typeof tailwindVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(tailwindVersion)) {
    throw invalidReference('tailwindVersion must be a semantic version')
  }
  if (typeof sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sourceSha256)) {
    throw invalidReference('sourceSha256 must be a SHA-256 digest')
  }
  if (
    !Array.isArray(shades) ||
    shades.length !== SHADE_NAMES.length ||
    !SHADE_NAMES.every((shade, index) => shades[index] === shade)
  ) {
    throw invalidReference('shade set does not match the generator')
  }
  if (!Array.isArray(families)) throw invalidReference('families must be an array')

  const names = new Set<string>()
  const parsedFamilies = families.map((family, index) => parseFamily(family, index, names))
  const chromaticCount = parsedFamilies.filter((family) => family.kind === 'chromatic').length
  const neutralCount = parsedFamilies.length - chromaticCount
  if (chromaticCount < 2 || neutralCount < 1) {
    throw invalidReference('requires at least two chromatic families and one neutral family')
  }

  return Object.freeze({
    tailwindVersion,
    sourceSha256,
    shades: SHADE_NAMES,
    families: Object.freeze(parsedFamilies),
  })
}

function parseFamily(value: unknown, index: number, names: Set<string>): PaletteFamily {
  if (!isRecord(value)) throw invalidReference(`family ${index} must be an object`)

  const { name, kind, colors } = value
  if (typeof name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(name)) {
    throw invalidReference(`family ${index} has an invalid name`)
  }
  if (names.has(name)) throw invalidReference(`family name ${name} is duplicated`)
  names.add(name)
  if (kind !== 'chromatic' && kind !== 'neutral') {
    throw invalidReference(`family ${name} has an invalid kind`)
  }
  if (!isRecord(colors)) throw invalidReference(`family ${name} has no color map`)

  const parsedColors = {} as Palette
  for (const shade of SHADE_NAMES) {
    parsedColors[shade] = Object.freeze(parseOklch(colors[shade], `${name}-${shade}`))
  }

  return Object.freeze({ name, kind, colors: Object.freeze(parsedColors) })
}

function parseOklch(value: unknown, label: string): OklchColor {
  if (!isRecord(value)) throw invalidReference(`${label} must be an OKLCH object`)
  const { l, c, h } = value
  if (typeof l !== 'number' || !Number.isFinite(l) || l < 0 || l > 1) {
    throw invalidReference(`${label} has invalid lightness`)
  }
  if (typeof c !== 'number' || !Number.isFinite(c) || c < 0) {
    throw invalidReference(`${label} has invalid chroma`)
  }
  if (typeof h !== 'number' || !Number.isFinite(h)) {
    throw invalidReference(`${label} has invalid hue`)
  }
  return { l, c, h }
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidReference(reason: string): Error {
  return new Error(`Tailwind reference is invalid: ${reason}.`)
}
