import { computed, ref } from 'vue'
import { contrastRatios, formatHex, formatOklch, mapToGamut, perceptualDistance } from '@/color'
import { generatePalette } from '@/palette'
import { loadTailwindFamilies } from '@/tailwind-data'
import {
  SHADE_NAMES,
  type Gamut,
  type OklchColor,
  type PaletteResult,
  type SeedMode,
  type Shade,
} from '@/types'
import { CHANNEL_MODES, type ChannelMode } from './channels'

export interface DisplayShade {
  shade: Shade
  raw: OklchColor
  mapped: OklchColor
  css: string
  hex: string
  inGamut: boolean
  contrastOnWhite: number
  contrastOnBlack: number
}

// Generation inputs
export const paletteName = ref('brand')
export const seedColor = ref('#16661f')
export const seedMode = ref<SeedMode>('exact')
export const anchor = ref<Shade | 'auto'>('auto')
export const gamut = ref<Gamut>('srgb')
export const huePath = ref('balanced')

// Editor state
export const channelMode = ref<ChannelMode>('oklch')
export const hiddenChannels = ref<string[]>([])
export const ghostFamilyName = ref('none')
export const selectedShade = ref<Shade>(500)
export const generationError = ref<string | null>(null)
export const lastResult = ref<PaletteResult | null>(null)

// Canonical palette being edited: raw OKLCH per shade. Everything else derives.
export const shades = ref<Record<Shade, OklchColor> | null>(null)

export const referenceFamilies = loadTailwindFamilies()

export function generate(): void {
  try {
    const result = generatePalette({
      name: paletteName.value,
      color: seedColor.value,
      seed: seedMode.value,
      anchor: anchor.value,
      gamut: gamut.value,
      huePath: huePath.value,
    })
    lastResult.value = result
    generationError.value = null
    resetToGenerated()
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : String(error)
    // A hue path from a previous seed can be invalid for the new one; retry balanced.
    if (huePath.value !== 'balanced') {
      huePath.value = 'balanced'
      generate()
    }
  }
}

export function resetToGenerated(): void {
  const result = lastResult.value
  if (!result) return
  shades.value = Object.fromEntries(
    SHADE_NAMES.map((shade) => [shade, { ...result.shades[shade].raw }]),
  ) as Record<Shade, OklchColor>
}

export function setShadeColor(shade: Shade, color: OklchColor): void {
  if (!shades.value) return
  shades.value = { ...shades.value, [shade]: color }
}

export const huePathOptions = computed<string[]>(() => {
  const result = lastResult.value
  if (!result || result.reference.kind !== 'chromatic') return ['balanced']
  return ['balanced', ...result.reference.neighbors]
})

export const visibleChannels = computed(() =>
  CHANNEL_MODES[channelMode.value].filter((channel) => !hiddenChannels.value.includes(channel.key)),
)

export function toggleChannel(key: string): void {
  hiddenChannels.value = hiddenChannels.value.includes(key)
    ? hiddenChannels.value.filter((existing) => existing !== key)
    : [...hiddenChannels.value, key]
}

export const displayShades = computed<DisplayShade[]>(() => {
  const current = shades.value
  if (!current) return []
  return SHADE_NAMES.map((shade) => {
    const raw = current[shade]
    const { color: mapped, inGamut } = mapToGamut(raw, gamut.value)
    const contrasts = contrastRatios(mapped)
    return {
      shade,
      raw,
      mapped,
      css: formatOklch(mapped),
      hex: formatHex(mapped),
      inGamut,
      contrastOnWhite: contrasts.onWhite,
      contrastOnBlack: contrasts.onBlack,
    }
  })
})

export const ghostShades = computed<Record<Shade, OklchColor> | null>(() => {
  const family = referenceFamilies.find((candidate) => candidate.name === ghostFamilyName.value)
  return family ? family.colors : null
})

export const warnings = computed<string[]>(() => {
  const current = shades.value
  if (!current) return []
  const messages: string[] = []

  const monotonic = SHADE_NAMES.every(
    (shade, index) => index === 0 || current[SHADE_NAMES[index - 1]].l > current[shade].l,
  )
  if (!monotonic) messages.push('Lightness is no longer strictly decreasing across shades.')

  let minimumDelta = Number.POSITIVE_INFINITY
  for (let index = 1; index < SHADE_NAMES.length; index += 1) {
    minimumDelta = Math.min(
      minimumDelta,
      perceptualDistance(current[SHADE_NAMES[index - 1]], current[SHADE_NAMES[index]]),
    )
  }
  if (minimumDelta < 0.01) {
    messages.push(
      `Smallest adjacent OKLab distance is ${minimumDelta.toFixed(4)}; neighboring shades may be hard to tell apart.`,
    )
  }

  const compressed = displayShades.value.filter((entry) => !entry.inGamut).length
  if (compressed > 0) {
    messages.push(
      `${compressed} shade${compressed === 1 ? ' is' : 's are'} outside ${gamut.value} and shown gamut-mapped.`,
    )
  }

  return messages
})
