import { computed, ref } from 'vue'
import { perceptualDistance } from '@/color'
import { evaluatePalette, generatePalette, PaletteInputError } from '@/palette'
import { loadTailwindFamilies } from '@/tailwind-data'
import {
  SHADE_NAMES,
  type DisplayShade,
  type Gamut,
  type OklchColor,
  type Palette,
  type PaletteResult,
  type ReadonlyPalette,
  type SeedMode,
  type Shade,
} from '@/types'
import { CHANNEL_MODES, type ChannelMode } from './channels'
import { clonePalette, rankReferences } from './palette-tools'
import {
  decodeSharedPalette,
  encodeSharedPalette,
  paletteToTuple,
  SharedPaletteError,
  tupleToPalette,
  type SharedPaletteV1,
} from './shared-palette'

export type OverlayMarker = 'diamond' | 'square' | 'triangle' | 'circle'
export type OverlayLine = 'dash' | 'dot' | 'dash-dot' | 'long-dash'
export type InspectorTab = 'references' | 'selection' | 'shade'
export interface GenerationIssue {
  field: 'name' | 'color' | 'form'
  message: string
}

interface OverlayConfig {
  name: string
  enabled: boolean
  color: string
  line: OverlayLine
  marker: OverlayMarker
  opacity: number
  score: number
}

export interface ActiveOverlay extends OverlayConfig {
  colors: ReadonlyPalette
}

// Line and marker styles identify references, so comparison data can use one
// quiet ink instead of introducing unexplained brand colors into the canvas.
const OVERLAY_COLOR = '#64748b'
const OVERLAY_LINES: OverlayLine[] = ['dash', 'dash-dot', 'dot', 'long-dash']
const OVERLAY_MARKERS: OverlayMarker[] = ['diamond', 'square', 'triangle', 'circle']

// Generation inputs
const DEFAULT_PALETTE_NAME = 'brand'
const DEFAULT_SEED_COLOR = '#16661f'

export const paletteName = ref(DEFAULT_PALETTE_NAME)
export const seedColor = ref(DEFAULT_SEED_COLOR)
export const seedMode = ref<SeedMode>('exact')
export const anchor = ref<Shade | 'auto'>('auto')
export const gamut = ref<Gamut>('srgb')
export const huePath = ref('balanced')

// Editor state
export const channelMode = ref<ChannelMode>('oklch')
export const hiddenChannels = ref<string[]>([])
export const inspectorTab = ref<InspectorTab>('selection')
export const selectedShade = ref<Shade>(500)
export const generationIssue = ref<GenerationIssue | null>(null)
export const generationError = computed(() => generationIssue.value?.message ?? null)
export const lastResult = ref<PaletteResult | null>(null)
export const baselineVisible = ref(false)
export const overlayConfigs = ref<OverlayConfig[]>([])
export const previewShades = ref<Palette | null>(null)
export const previewLabel = ref<string | null>(null)
export const shareLoadError = ref<string | null>(null)

// Canonical editable state. Preview, alternate spaces, display colors and exports derive from it.
export const shades = ref<Palette | null>(null)
export const generatedShades = ref<Palette | null>(null)
export const history = ref<Palette[]>([])
export const historyIndex = ref(-1)
let continuousEditStart: Palette | null = null
let restoringSharedPalette = false

const referenceFamilies = loadTailwindFamilies()

export const effectiveShades = computed(() => previewShades.value ?? shades.value)
export const committedPaletteName = computed(() => lastResult.value?.name ?? paletteName.value)
export const canUndo = computed(() => historyIndex.value > 0)
export const canRedo = computed(
  () => historyIndex.value >= 0 && historyIndex.value < history.value.length - 1,
)
export const canReset = computed(
  () =>
    shades.value !== null &&
    generatedShades.value !== null &&
    !palettesMatch(shades.value, generatedShades.value),
)

export function generate(): boolean {
  const selectedHuePath = huePath.value
  let result: PaletteResult

  try {
    result = generateWithHuePath(selectedHuePath)
  } catch (error) {
    if (selectedHuePath === 'balanced') {
      setGenerationError(error)
      return false
    }

    try {
      result = generateWithHuePath('balanced')
      huePath.value = 'balanced'
    } catch {
      setGenerationError(error)
      return false
    }
  }

  applyGeneration(result)
  return true
}

function generateWithHuePath(selectedHuePath: string): PaletteResult {
  return generatePalette({
    name: paletteName.value,
    color: seedColor.value,
    seed: seedMode.value,
    anchor: anchor.value,
    gamut: gamut.value,
    huePath: selectedHuePath,
  })
}

function applyGeneration(result: PaletteResult): void {
  lastResult.value = result
  generationIssue.value = null
  const generated = Object.fromEntries(
    SHADE_NAMES.map((shade) => [shade, { ...result.shades[shade].raw }]),
  ) as Palette
  generatedShades.value = generated
  shades.value = clonePalette(generated)
  clearPreview()
  history.value = [clonePalette(generated)]
  historyIndex.value = 0
  selectedShade.value = result.configuration.anchor
  initializeOverlays(generated, result.reference.kind)
  syncSharedPaletteUrl()
}

function setGenerationError(error: unknown): void {
  generationIssue.value = {
    field: error instanceof PaletteInputError ? error.field : 'form',
    message: error instanceof Error ? error.message : String(error),
  }
}

export function resetToGenerated(): void {
  if (!generatedShades.value || !canReset.value) return
  commitPalette(generatedShades.value)
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

export function endContinuousEdit(): void {
  const current = shades.value
  const start = continuousEditStart
  if (!current || !start) return
  const changed = SHADE_NAMES.some(
    (shade) => perceptualDistance(current[shade], start[shade]) > 1e-10,
  )
  continuousEditStart = null
  if (changed) pushHistory(current)
}

export function setPreview(palette: ReadonlyPalette, label: string): void {
  previewShades.value = clonePalette(palette)
  previewLabel.value = label
}

export function clearPreview(): void {
  previewShades.value = null
  previewLabel.value = null
}

export function applyPreview(): void {
  if (!previewShades.value) return
  commitPalette(previewShades.value)
}

export function commitPalette(palette: ReadonlyPalette): boolean {
  if (shades.value && palettesMatch(shades.value, palette)) {
    clearPreview()
    return false
  }
  shades.value = clonePalette(palette)
  clearPreview()
  pushHistory(palette)
  return true
}

export function undo(): void {
  if (!canUndo.value) return
  historyIndex.value -= 1
  shades.value = clonePalette(history.value[historyIndex.value])
  clearPreview()
  syncSharedPaletteUrl()
}

export function redo(): void {
  if (!canRedo.value) return
  historyIndex.value += 1
  shades.value = clonePalette(history.value[historyIndex.value])
  clearPreview()
  syncSharedPaletteUrl()
}

function pushHistory(palette: ReadonlyPalette): void {
  const current = history.value[historyIndex.value]
  if (current && palettesMatch(current, palette)) return
  const retained = history.value.slice(0, historyIndex.value + 1)
  retained.push(clonePalette(palette))
  history.value = retained
  historyIndex.value = retained.length - 1
  syncSharedPaletteUrl()
}

export type SharedPaletteRestoreResult = 'absent' | 'restored' | 'invalid'

export function restoreSharedPaletteFromHash(hash: string): SharedPaletteRestoreResult {
  let shared: SharedPaletteV1 | null
  try {
    shared = decodeSharedPalette(hash)
  } catch (error) {
    shareLoadError.value =
      error instanceof SharedPaletteError ? error.message : 'This share link could not be loaded.'
    return 'invalid'
  }
  if (!shared) return 'absent'

  const [name, color, seed, savedAnchor, savedGamut, savedHuePath] = shared.r
  restoringSharedPalette = true
  paletteName.value = name
  seedColor.value = color
  seedMode.value = seed
  anchor.value = savedAnchor
  gamut.value = savedGamut
  huePath.value = savedHuePath

  try {
    const result = generateWithHuePath(savedHuePath)
    applyGeneration(result)
    const baseline = tupleToPalette(shared.b)
    const current = tupleToPalette(shared.p)
    generatedShades.value = baseline
    shades.value = current
    history.value = [clonePalette(current)]
    historyIndex.value = 0
    selectedShade.value = result.configuration.anchor
    initializeOverlays(baseline, result.reference.kind)
    shareLoadError.value = null
  } catch (error) {
    shareLoadError.value =
      error instanceof Error ? `This share link is not compatible: ${error.message}` : String(error)
    paletteName.value = DEFAULT_PALETTE_NAME
    seedColor.value = DEFAULT_SEED_COLOR
    seedMode.value = 'exact'
    anchor.value = 'auto'
    gamut.value = 'srgb'
    huePath.value = 'balanced'
    restoringSharedPalette = false
    return 'invalid'
  }

  restoringSharedPalette = false
  syncSharedPaletteUrl()
  return 'restored'
}

export function dismissShareLoadError(): void {
  shareLoadError.value = null
}

export function selectShade(shade: Shade): void {
  selectedShade.value = shade
  inspectorTab.value = 'shade'
}

function syncSharedPaletteUrl(): void {
  if (
    restoringSharedPalette ||
    typeof window === 'undefined' ||
    !shades.value ||
    !generatedShades.value
  ) {
    return
  }
  const payload: SharedPaletteV1 = {
    v: 1,
    r: [
      paletteName.value,
      seedColor.value,
      seedMode.value,
      anchor.value,
      gamut.value,
      huePath.value,
    ],
    b: paletteToTuple(generatedShades.value),
    p: paletteToTuple(shades.value),
  }
  try {
    const url = new URL(window.location.href)
    url.hash = encodeSharedPalette(payload)
    window.history.replaceState(window.history.state, '', url)
  } catch (error) {
    shareLoadError.value =
      error instanceof Error ? error.message : 'The live share URL could not be updated.'
  }
}

function palettesMatch(left: ReadonlyPalette, right: ReadonlyPalette): boolean {
  return SHADE_NAMES.every((shade) => perceptualDistance(left[shade], right[shade]) <= 1e-10)
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

type OverlayUpdate = Partial<
  Pick<OverlayConfig, 'enabled' | 'color' | 'line' | 'marker' | 'opacity'>
>

export function updateOverlay(name: string, update: OverlayUpdate): void {
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
    color: OVERLAY_COLOR,
    line: OVERLAY_LINES[index % OVERLAY_LINES.length],
    marker: OVERLAY_MARKERS[index % OVERLAY_MARKERS.length],
    opacity: 0.72,
    score: rank?.score ?? 0,
  })
}

export function removeOverlay(name: string): void {
  overlayConfigs.value = overlayConfigs.value.filter((overlay) => overlay.name !== name)
}

function initializeOverlays(palette: ReadonlyPalette, kind: 'chromatic' | 'neutral'): void {
  const ranked = rankReferences(
    palette,
    referenceFamilies.filter((family) => family.kind === kind),
  ).slice(0, 3)
  overlayConfigs.value = ranked.map((rank, index) => ({
    name: rank.family.name,
    enabled: index === 0,
    color: OVERLAY_COLOR,
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

const paletteEvaluation = computed(() => {
  const current = effectiveShades.value
  return current ? evaluatePalette(current, gamut.value) : null
})

export const displayShades = computed<DisplayShade[]>(() => {
  const evaluation = paletteEvaluation.value
  return evaluation ? SHADE_NAMES.map((shade) => ({ shade, ...evaluation.shades[shade] })) : []
})

export const warnings = computed<string[]>(() => {
  const evaluation = paletteEvaluation.value
  if (!evaluation) return []
  const messages: string[] = []
  if (!evaluation.lightnessMonotonic) {
    messages.push(
      'Some darker-numbered shades are lighter than the shade before them. Adjust the lightness curve to restore a steady light-to-dark order.',
    )
  }

  if (evaluation.minimumAdjacentDelta < 0.01) {
    messages.push(
      `Some neighboring shades are very similar (minimum OKLab difference: ${evaluation.minimumAdjacentDelta.toFixed(4)}). Increase the space between them if they need to look distinct.`,
    )
  }

  const adjustedShades = displayShades.value
    .filter((entry) => !entry.inGamut)
    .map((entry) => entry.shade)
  if (adjustedShades.length > 0) {
    const gamutName = gamut.value === 'srgb' ? 'sRGB' : 'Display P3'
    const shadeLabel = adjustedShades.length === 1 ? 'Shade' : 'Shades'
    messages.push(
      `${shadeLabel} ${adjustedShades.join(', ')} exceed ${gamutName}. The preview and exported values use the closest colors that ${gamutName} can display.`,
    )
  }
  return messages
})
