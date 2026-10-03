import { computed, ref, shallowRef, watch } from 'vue'
import { perceptualDistance } from '@/color'
import { evaluatePalette, generatePalette } from '@/palette'
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
import { cancelPendingGeneration } from './pending-generation'
import { clonePalette, rankReferences } from './palette-tools'
import { isValidPaletteName } from './palette-name'
import { applyEnd, emptyEnds, type EndsState, type EndSide, type EndPatch } from './scale-ends'
import {
  decodeSharedPalette,
  encodeSharedPalette,
  paletteToTuple,
  SharedPaletteError,
  tupleToPalette,
  type SharedPaletteV1,
} from './shared-palette'

export interface GenerationIssue {
  field: 'color'
  message: string
}
export interface GenerationSettings {
  seedColor: string
  seedMode: SeedMode
  anchor: Shade | 'auto'
  gamut: Gamut
  huePath: string
}
export interface HistoryEntry {
  palette: Palette
  generated: Palette
  result: PaletteResult
  settings: GenerationSettings
  ends: EndsState
  selected: Shade
  reference: string
}
export type GenerateOutcome = { ok: true; replaced: number } | { ok: false }
const DEFAULT_PALETTE_NAME = 'brand'
const DEFAULT_SEED_COLOR = '#16661f'
export const paletteName = ref(DEFAULT_PALETTE_NAME)
export const committedPaletteName = ref(DEFAULT_PALETTE_NAME)
export const nameIsValid = computed(() => isValidPaletteName(paletteName.value))
export const seedColor = ref(DEFAULT_SEED_COLOR)
export const seedMode = ref<SeedMode>('exact')
export const anchor = ref<Shade | 'auto'>('auto')
export const gamut = ref<Gamut>('srgb')
export const huePath = ref('balanced')
export const selectedShade = ref<Shade>(500)
export const referenceName = ref('')
export const lastResult = shallowRef<PaletteResult | null>(null)
export const generatedShades = shallowRef<Palette | null>(null)
export const shades = shallowRef<Palette | null>(null)
export const endsState = shallowRef<EndsState>(emptyEnds())
export const generationIssue = ref<GenerationIssue | null>(null)
export const generationError = computed(() => generationIssue.value?.message ?? null)
export const shareLoadError = ref<string | null>(null)
export const history = shallowRef<HistoryEntry[]>([])
export const historyIndex = ref(-1)
export const canUndo = computed(() => historyIndex.value > 0)
export const canRedo = computed(
  () => historyIndex.value >= 0 && historyIndex.value < history.value.length - 1,
)
export const anchorShade = computed(() => lastResult.value?.configuration.anchor ?? null)
const allFamilies = loadTailwindFamilies()
export const referenceFamilies = computed(() =>
  allFamilies.filter((family) => family.kind === lastResult.value?.reference.kind),
)
export const referenceRanks = computed(() =>
  shades.value ? rankReferences(shades.value, referenceFamilies.value).slice(0, 4) : [],
)
export const referenceFamily = computed(
  () => referenceFamilies.value.find((family) => family.name === referenceName.value) ?? null,
)
export const hueDriftOptions = computed<string[]>(() =>
  lastResult.value?.reference.kind === 'chromatic'
    ? [
        lastResult.value.reference.neighbors[0]!,
        'balanced',
        lastResult.value.reference.neighbors[1]!,
      ]
    : ['balanced'],
)
export const changedShades = computed(() =>
  SHADE_NAMES.filter(
    (shade) =>
      shades.value &&
      generatedShades.value &&
      perceptualDistance(shades.value[shade], generatedShades.value[shade]) > 1e-10,
  ),
)
const paletteEvaluation = computed(() =>
  shades.value ? evaluatePalette(shades.value, gamut.value) : null,
)
export const displayShades = computed<DisplayShade[]>(() =>
  paletteEvaluation.value
    ? SHADE_NAMES.map((shade) => ({ shade, ...paletteEvaluation.value!.shades[shade] }))
    : [],
)
let restoringSharedPalette = false
watch(
  paletteName,
  (value) => {
    if (isValidPaletteName(value)) {
      committedPaletteName.value = value
      syncSharedPaletteUrl()
    }
  },
  { flush: 'sync' },
)
function makeEntry(): HistoryEntry | null {
  if (!shades.value || !generatedShades.value || !lastResult.value) return null
  return {
    palette: clonePalette(shades.value),
    generated: clonePalette(generatedShades.value),
    result: lastResult.value,
    settings: {
      seedColor: lastResult.value.input.original,
      seedMode: lastResult.value.configuration.seed,
      anchor: lastResult.value.configuration.anchorWasInferred
        ? 'auto'
        : lastResult.value.configuration.anchor,
      gamut: lastResult.value.configuration.gamut,
      huePath: lastResult.value.configuration.huePath,
    },
    ends: endsState.value,
    selected: selectedShade.value,
    reference: referenceName.value,
  }
}
function palettesMatch(left: ReadonlyPalette, right: ReadonlyPalette): boolean {
  return SHADE_NAMES.every((shade) => perceptualDistance(left[shade], right[shade]) <= 1e-10)
}
export function commit(): void {
  const next = makeEntry()
  if (!next) return
  dismissShareLoadError()
  const current = history.value[historyIndex.value]
  if (
    current &&
    palettesMatch(current.palette, next.palette) &&
    palettesMatch(current.generated, next.generated) &&
    current.ends === next.ends
  )
    return
  history.value = [...history.value.slice(0, historyIndex.value + 1), next].slice(-200)
  historyIndex.value = history.value.length - 1
  syncSharedPaletteUrl()
}
function generateWithHuePath(path: string): PaletteResult {
  return generatePalette({
    name: committedPaletteName.value,
    color: seedColor.value,
    seed: seedMode.value,
    anchor: anchor.value,
    gamut: gamut.value,
    huePath: path,
  })
}
export function generate(): GenerateOutcome {
  seedColor.value = seedColor.value.trim()
  let result: PaletteResult
  try {
    result = generateWithHuePath(huePath.value)
  } catch (error) {
    try {
      if (huePath.value === 'balanced') throw error
      result = generateWithHuePath('balanced')
      huePath.value = 'balanced'
    } catch {
      generationIssue.value = {
        field: 'color',
        message: error instanceof Error ? error.message : String(error),
      }
      return { ok: false }
    }
  }
  const current = history.value[historyIndex.value]
  if (current) {
    history.value = history.value.map((entry, index) =>
      index === historyIndex.value
        ? { ...entry, selected: selectedShade.value, reference: referenceName.value }
        : entry,
    )
  }
  dismissShareLoadError()
  const replaced = changedShades.value.length
  lastResult.value = result
  generatedShades.value = Object.fromEntries(
    SHADE_NAMES.map((shade) => [shade, { ...result.shades[shade].raw }]),
  ) as Palette
  shades.value = clonePalette(generatedShades.value)
  endsState.value = emptyEnds()
  selectedShade.value = result.configuration.anchor
  if (
    referenceName.value !== 'none' &&
    !referenceRanks.value.some((rank) => rank.family.name === referenceName.value)
  )
    referenceName.value = referenceRanks.value[0]?.family.name ?? 'none'
  generationIssue.value = null
  commit()
  return { ok: true, replaced }
}
export function updateGeneration(patch: Partial<GenerationSettings>): GenerateOutcome {
  if (patch.seedColor !== undefined) seedColor.value = patch.seedColor
  if (patch.seedMode !== undefined) seedMode.value = patch.seedMode
  if (patch.anchor !== undefined) anchor.value = patch.anchor
  if (patch.gamut !== undefined) gamut.value = patch.gamut
  if (patch.huePath !== undefined) huePath.value = patch.huePath
  return generate()
}
export function setShadeColor(shade: Shade, color: OklchColor): void {
  if (shades.value) shades.value = { ...shades.value, [shade]: { ...color } }
}
export function commitShade(shade: Shade, color: OklchColor): void {
  setShadeColor(shade, color)
  commit()
}
export function resetShade(shade: Shade): void {
  if (generatedShades.value) commitShade(shade, generatedShades.value[shade])
}
export function adjustEnd(side: EndSide, patch: EndPatch): void {
  if (!shades.value || !anchorShade.value) return
  const next = applyEnd(side, shades.value, endsState.value[side], patch, anchorShade.value)
  shades.value = next.palette
  endsState.value = { ...endsState.value, [side]: next.state }
}
export function resetEnd(side: EndSide): void {
  adjustEnd(side, { chroma: null, lightness: null })
  commit()
}
export function resetEnds(): void {
  adjustEnd('dark', { chroma: null, lightness: null })
  adjustEnd('light', { chroma: null, lightness: null })
  commit()
}
function restoreEntry(saved: HistoryEntry): void {
  seedColor.value = saved.settings.seedColor
  seedMode.value = saved.settings.seedMode
  anchor.value = saved.settings.anchor
  gamut.value = saved.settings.gamut
  huePath.value = saved.settings.huePath
  lastResult.value = saved.result
  generatedShades.value = clonePalette(saved.generated)
  shades.value = clonePalette(saved.palette)
  endsState.value = saved.ends
  selectedShade.value = saved.selected
  referenceName.value = saved.reference
  generationIssue.value = null
  syncSharedPaletteUrl()
}
export function undo(): void {
  cancelPendingGeneration()
  if (canUndo.value) {
    historyIndex.value--
    restoreEntry(history.value[historyIndex.value]!)
  }
}
export function redo(): void {
  cancelPendingGeneration()
  if (canRedo.value) {
    historyIndex.value++
    restoreEntry(history.value[historyIndex.value]!)
  }
}
export function selectShade(shade: Shade): void {
  selectedShade.value = shade
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
  committedPaletteName.value = name
  seedColor.value = color
  seedMode.value = seed
  anchor.value = savedAnchor
  gamut.value = savedGamut
  huePath.value = savedHuePath

  try {
    const result = generateWithHuePath(savedHuePath)
    lastResult.value = result
    const baseline = tupleToPalette(shared.b)
    const current = tupleToPalette(shared.p)
    generatedShades.value = baseline
    shades.value = current
    endsState.value = emptyEnds()
    selectedShade.value = result.configuration.anchor
    referenceName.value = referenceRanks.value[0]?.family.name ?? 'none'
    generationIssue.value = null
    history.value = [makeEntry()!]
    historyIndex.value = 0
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

function syncSharedPaletteUrl(): void {
  const saved = history.value[historyIndex.value]
  if (restoringSharedPalette || typeof window === 'undefined' || !saved) return
  const payload: SharedPaletteV1 = {
    v: 1,
    r: [
      committedPaletteName.value,
      saved.settings.seedColor,
      saved.settings.seedMode,
      saved.settings.anchor,
      saved.settings.gamut,
      saved.settings.huePath,
    ],
    b: paletteToTuple(saved.generated),
    p: paletteToTuple(saved.palette),
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
export const warnings = computed<string[]>(() => {
  const evaluation = paletteEvaluation.value
  if (!evaluation) return []
  const messages: string[] = []
  if (!evaluation.lightnessMonotonic) {
    messages.push(
      'Some higher shades are lighter than the shade before them. Adjust the lightness curve to restore a steady light-to-dark order.',
    )
  }

  if (evaluation.minimumAdjacentDelta < 0.01) {
    messages.push(
      'Some neighboring shades are almost identical. Increase the space between them if they need to look distinct.',
    )
  }

  const adjustedShades = displayShades.value
    .filter((entry) => !entry.inGamut)
    .map((entry) => entry.shade)
  if (adjustedShades.length > 0) {
    const gamutName = gamut.value === 'srgb' ? 'sRGB' : 'Display P3'
    const shadeLabel = adjustedShades.length === 1 ? 'Shade' : 'Shades'
    messages.push(
      `${shadeLabel} ${adjustedShades.join(', ')} exceed ${gamutName}. Preview and export use the closest color ${gamutName} can show.`,
    )
  }
  return messages
})
