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
import { clonePalette, rankReferences } from './palette-tools'

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

export type OverlayMarker = 'diamond' | 'square' | 'triangle' | 'circle'
export type OverlayLine = 'dash' | 'dot' | 'dash-dot' | 'long-dash'

export interface OverlayConfig {
  name: string
  enabled: boolean
  color: string
  line: OverlayLine
  marker: OverlayMarker
  opacity: number
  score: number
}

export interface ActiveOverlay extends OverlayConfig {
  colors: Record<Shade, OklchColor>
}

export interface HistoryEntry {
  label: string
  palette: Record<Shade, OklchColor>
}

const OVERLAY_COLORS = ['#f4c45e', '#67d5ff', '#f18ac2', '#a7df78']
const OVERLAY_LINES: OverlayLine[] = ['dash', 'dash-dot', 'dot', 'long-dash']
const OVERLAY_MARKERS: OverlayMarker[] = ['diamond', 'square', 'triangle', 'circle']

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
export const selectedShade = ref<Shade>(500)
export const generationError = ref<string | null>(null)
export const lastResult = ref<PaletteResult | null>(null)
export const baselineVisible = ref(false)
export const overlayConfigs = ref<OverlayConfig[]>([])
export const previewShades = ref<Record<Shade, OklchColor> | null>(null)
export const previewLabel = ref<string | null>(null)

// Canonical editable state. Preview, alternate spaces, display colors and exports derive from it.
export const shades = ref<Record<Shade, OklchColor> | null>(null)
export const generatedShades = ref<Record<Shade, OklchColor> | null>(null)
export const history = ref<HistoryEntry[]>([])
export const historyIndex = ref(-1)
let continuousEditStart: Record<Shade, OklchColor> | null = null

export const referenceFamilies = loadTailwindFamilies()

export const effectiveShades = computed(() => previewShades.value ?? shades.value)
export const canUndo = computed(() => historyIndex.value > 0)
export const canRedo = computed(
  () => historyIndex.value >= 0 && historyIndex.value < history.value.length - 1,
)

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
    const generated = Object.fromEntries(
      SHADE_NAMES.map((shade) => [shade, { ...result.shades[shade].raw }]),
    ) as Record<Shade, OklchColor>
    generatedShades.value = generated
    shades.value = clonePalette(generated)
    previewShades.value = null
    previewLabel.value = null
    history.value = [{ label: 'Generated palette', palette: clonePalette(generated) }]
    historyIndex.value = 0
    initializeOverlays(generated, result.reference.kind)
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : String(error)
    if (huePath.value !== 'balanced') {
      huePath.value = 'balanced'
      generate()
    }
  }
}

export function resetToGenerated(): void {
  if (!generatedShades.value) return
  commitPalette(generatedShades.value, 'Reset to generated palette')
}

export function setShadeColor(shade: Shade, color: OklchColor): void {
  if (!shades.value) return
  clearPreview()
  shades.value = { ...shades.value, [shade]: color }
}

export function beginContinuousEdit(): void {
  continuousEditStart = shades.value ? clonePalette(shades.value) : null
  clearPreview()
}

export function endContinuousEdit(label: string): void {
  if (!shades.value || !continuousEditStart) return
  const changed = SHADE_NAMES.some(
    (shade) => perceptualDistance(shades.value![shade], continuousEditStart![shade]) > 1e-10,
  )
  continuousEditStart = null
  if (changed) pushHistory(label, shades.value)
}

export function setPreview(palette: Record<Shade, OklchColor>, label: string): void {
  previewShades.value = clonePalette(palette)
  previewLabel.value = label
}

export function clearPreview(): void {
  previewShades.value = null
  previewLabel.value = null
}

export function applyPreview(): void {
  if (!previewShades.value) return
  commitPalette(previewShades.value, previewLabel.value ?? 'Applied transformation')
}

export function commitPalette(palette: Record<Shade, OklchColor>, label: string): void {
  shades.value = clonePalette(palette)
  clearPreview()
  pushHistory(label, palette)
}

export function undo(): void {
  if (!canUndo.value) return
  historyIndex.value -= 1
  shades.value = clonePalette(history.value[historyIndex.value].palette)
  clearPreview()
}

export function redo(): void {
  if (!canRedo.value) return
  historyIndex.value += 1
  shades.value = clonePalette(history.value[historyIndex.value].palette)
  clearPreview()
}

export function restoreHistory(index: number): void {
  const entry = history.value[index]
  if (!entry) return
  historyIndex.value = index
  shades.value = clonePalette(entry.palette)
  clearPreview()
}

function pushHistory(label: string, palette: Record<Shade, OklchColor>): void {
  const retained = history.value.slice(0, historyIndex.value + 1)
  retained.push({ label, palette: clonePalette(palette) })
  history.value = retained
  historyIndex.value = retained.length - 1
}

export const referenceRanks = computed(() => {
  const current = generatedShades.value
  if (!current) return []
  return rankReferences(current, referenceFamilies)
})

export const activeOverlays = computed<ActiveOverlay[]>(() =>
  overlayConfigs.value
    .filter((overlay) => overlay.enabled)
    .flatMap((overlay) => {
      const family = referenceFamilies.find((candidate) => candidate.name === overlay.name)
      return family ? [{ ...overlay, colors: family.colors }] : []
    }),
)

export function updateOverlay(name: string, update: Partial<OverlayConfig>): void {
  overlayConfigs.value = overlayConfigs.value.map((overlay) =>
    overlay.name === name ? { ...overlay, ...update } : overlay,
  )
}

export function soloOverlay(name: string): void {
  overlayConfigs.value = overlayConfigs.value.map((overlay) => ({
    ...overlay,
    enabled: overlay.name === name,
  }))
}

export function addOverlay(name: string): void {
  if (overlayConfigs.value.some((overlay) => overlay.name === name)) {
    updateOverlay(name, { enabled: true })
    return
  }
  const rank = referenceRanks.value.find((candidate) => candidate.family.name === name)
  const index = overlayConfigs.value.length
  overlayConfigs.value.push({
    name,
    enabled: true,
    color: OVERLAY_COLORS[index % OVERLAY_COLORS.length],
    line: OVERLAY_LINES[index % OVERLAY_LINES.length],
    marker: OVERLAY_MARKERS[index % OVERLAY_MARKERS.length],
    opacity: 0.72,
    score: rank?.score ?? 0,
  })
}

export function removeOverlay(name: string): void {
  overlayConfigs.value = overlayConfigs.value.filter((overlay) => overlay.name !== name)
}

function initializeOverlays(
  palette: Record<Shade, OklchColor>,
  kind: 'chromatic' | 'neutral',
): void {
  const ranked = rankReferences(
    palette,
    referenceFamilies.filter((family) => family.kind === kind),
  ).slice(0, 3)
  overlayConfigs.value = ranked.map((rank, index) => ({
    name: rank.family.name,
    enabled: index === 0,
    color: OVERLAY_COLORS[index],
    line: OVERLAY_LINES[index],
    marker: OVERLAY_MARKERS[index],
    opacity: 0.72,
    score: rank.score,
  }))
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
  const current = effectiveShades.value
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

export const warnings = computed<string[]>(() => {
  const current = effectiveShades.value
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
  if (previewShades.value)
    messages.unshift(`Previewing: ${previewLabel.value ?? 'transformation'}.`)
  return messages
})
