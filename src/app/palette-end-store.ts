import { computed, reactive, ref, toRef, watch } from 'vue'
import { SHADE_NAMES, type Palette, type ReadonlyPalette } from '@/types'
import {
  applyPreview,
  clearPreview,
  effectiveShades,
  previewShades,
  setPreview,
  shades,
} from './palette-store'
import { adjustPaletteEnds, clonePalette, type PaletteEndOptions } from './palette-tools'

type EndpointPreset = 'original' | 'neutral' | 'contrast'
type EndpointValueKey = 'lightness' | 'darkLightness' | 'lightTint' | 'darkTint'

interface EndpointControlState {
  lightness: number
  darkLightness: number
  lightTint: number
  darkTint: number
  spread: number
}

interface EndpointPresetDefinition extends Omit<EndpointControlState, 'spread'> {
  id: EndpointPreset
  label: string
}

const controls = reactive<EndpointControlState>({
  lightness: 1,
  darkLightness: 0,
  lightTint: 1,
  darkTint: 1,
  spread: 4,
})
const endpointBase = ref<Palette | null>(null)
let appliedState: EndpointControlState | null = null
let applyingPreview = false

export const endpointLightness = toRef(controls, 'lightness')
export const endpointDarkLightness = toRef(controls, 'darkLightness')
export const endpointLightTint = toRef(controls, 'lightTint')
export const endpointDarkTint = toRef(controls, 'darkTint')
export const endpointSpread = toRef(controls, 'spread')

function sliderModel(key: EndpointValueKey) {
  return computed({
    get: () => [controls[key]],
    set: (values: number[]) => {
      const value = values[0]
      if (value === undefined) return
      controls[key] = value
      previewEndpointChanges()
    },
  })
}

export const endpointLightnessModel = sliderModel('lightness')
export const endpointDarkLightnessModel = sliderModel('darkLightness')
export const endpointLightTintModel = sliderModel('lightTint')
export const endpointDarkTintModel = sliderModel('darkTint')

export const endpointLightnessMinimum = computed(() =>
  Math.min(1, (endpointBase.value?.[100].l ?? 0.85) + 0.001),
)
export const endpointDarkLightnessMaximum = computed(() =>
  Math.max(0, (endpointBase.value?.[900].l ?? 0.45) - 0.001),
)
export const endpointBefore = computed(() => {
  if (!endpointBase.value) return null
  return {
    light: endpointBase.value[50],
    dark: endpointBase.value[950],
  }
})
export const endpointAfter = computed(() => {
  if (!effectiveShades.value) return null
  return {
    light: effectiveShades.value[50],
    dark: effectiveShades.value[950],
  }
})
export const endpointPresets = computed<EndpointPresetDefinition[]>(() => {
  const before = endpointBefore.value
  if (!before) return []
  return [
    {
      id: 'original',
      label: 'Original',
      lightness: before.light.l,
      darkLightness: before.dark.l,
      lightTint: 1,
      darkTint: 1,
    },
    {
      id: 'neutral',
      label: 'Neutral',
      lightness: before.light.l,
      darkLightness: before.dark.l,
      lightTint: 0,
      darkTint: 0,
    },
    {
      id: 'contrast',
      label: 'White + ink',
      lightness: Math.max(before.light.l, 0.995),
      darkLightness: Math.min(before.dark.l, 0.16),
      lightTint: 0,
      darkTint: 0,
    },
  ]
})
export const activeEndpointPreset = computed<EndpointPreset | null>(() => {
  const preset = endpointPresets.value.find(
    (candidate) =>
      close(candidate.lightness, controls.lightness) &&
      close(candidate.darkLightness, controls.darkLightness) &&
      close(candidate.lightTint, controls.lightTint) &&
      close(candidate.darkTint, controls.darkTint),
  )
  return preset?.id ?? null
})

watch(
  shades,
  (palette) => {
    if (!palette) return
    if (applyingPreview) {
      applyingPreview = false
      return
    }
    beginEndpointSession(palette)
  },
  { immediate: true, flush: 'sync' },
)

watch(
  previewShades,
  (preview, previous) => {
    if (!preview && previous) syncControls(appliedState)
  },
  { flush: 'sync' },
)

export function selectEndpointPreset(value: unknown): void {
  const preset = endpointPresets.value.find((candidate) => candidate.id === value)
  if (!preset) return
  controls.lightness = preset.lightness
  controls.darkLightness = preset.darkLightness
  controls.lightTint = preset.lightTint
  controls.darkTint = preset.darkTint
  previewEndpointChanges()
}

export function selectEndpointSpread(value: unknown): void {
  const spread = Number(value)
  if (spread !== 2 && spread !== 3 && spread !== 4) return
  controls.spread = spread
  previewEndpointChanges()
}

export function cancelEndpointPreview(): void {
  clearPreview()
}

export function applyEndpointPreview(): void {
  if (!previewShades.value) return
  appliedState = currentState()
  applyingPreview = true
  applyPreview()
}

function beginEndpointSession(palette: ReadonlyPalette): void {
  endpointBase.value = clonePalette(palette)
  appliedState = {
    lightness: palette[50].l,
    darkLightness: palette[950].l,
    lightTint: 1,
    darkTint: 1,
    spread: controls.spread,
  }
  syncControls(appliedState)
}

function previewEndpointChanges(): void {
  if (!shades.value || !endpointBase.value) return
  const target = adjustPaletteEnds(endpointBase.value, endpointOptions())
  if (palettesMatch(target, shades.value)) {
    clearPreview()
    return
  }
  setPreview(target, `Adjusting scale ends across ${controls.spread} shades`)
}

function endpointOptions(): PaletteEndOptions {
  return {
    light: {
      lightness: controls.lightness,
      tintRetention: controls.lightTint,
    },
    dark: {
      lightness: controls.darkLightness,
      tintRetention: controls.darkTint,
    },
    spread: controls.spread,
  }
}

function currentState(): EndpointControlState {
  return { ...controls }
}

function syncControls(state: EndpointControlState | null): void {
  if (state) Object.assign(controls, state)
}

function palettesMatch(first: ReadonlyPalette, second: ReadonlyPalette): boolean {
  return SHADE_NAMES.every(
    (shade) =>
      close(first[shade].l, second[shade].l) &&
      close(first[shade].c, second[shade].c) &&
      close(first[shade].h, second[shade].h),
  )
}

function close(first: number, second: number): boolean {
  return Math.abs(first - second) < 1e-6
}
