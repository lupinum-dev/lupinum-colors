import { circularHueDistance } from '../color'
import { SHADE_NAMES, type OklchColor, type Palette, type ReadonlyPalette, type Shade } from '../types'
import { adjustPaletteEnds, clonePalette, type PaletteEndOptions } from './palette-tools'

export type EndSide = 'dark' | 'light'
export type ShadeColors = Partial<Record<Shade, OklchColor>>

export interface EndSideState {
  /** Target chroma of the end shade. null = unchanged. */
  readonly chroma: number | null
  /** Target lightness of the end shade. null = unchanged. */
  readonly lightness: number | null
  /** Colors of the adjusted shades before this side changed them. */
  readonly origin: ShadeColors
  /** Colors this side wrote the last time it ran. */
  readonly written: ShadeColors
}
export type EndsState = Readonly<Record<EndSide, EndSideState>>
export type EndPatch = Partial<Pick<EndSideState, 'chroma' | 'lightness'>>

export const END_SHADE: Readonly<Record<EndSide, Shade>> = { dark: 950, light: 50 }

/** Named after Tailwind grays whose end shade has this chroma. */
export const END_STOPS: Readonly<Record<EndSide, readonly { label: string; chroma: number }[]>> = {
  dark: [
    { label: 'Slate', chroma: 0.042 },
    { label: 'Zinc', chroma: 0.005 },
    { label: 'Gray', chroma: 0 },
  ],
  light: [
    { label: 'Slate', chroma: 0.003 },
    { label: 'White', chroma: 0 },
  ],
}

const EMPTY_SIDE: EndSideState = { chroma: null, lightness: null, origin: {}, written: {} }
export function emptyEnds(): EndsState {
  return { dark: EMPTY_SIDE, light: EMPTY_SIDE }
}

export function isAdjusted(state: EndSideState): boolean {
  return state.chroma !== null || state.lightness !== null
}

/** The three outer shades on each side, never reaching the anchor. */
export function endTail(side: EndSide, anchor: Shade): Shade[] {
  const a = SHADE_NAMES.indexOf(anchor)
  if (side === 'dark') return SHADE_NAMES.slice(Math.max(a + 1, SHADE_NAMES.indexOf(800)))
  const last = Math.min(a - 1, SHADE_NAMES.indexOf(200))
  return last >= 0 ? SHADE_NAMES.slice(0, last + 1) : []
}

function sameColor(a: OklchColor, b: OklchColor): boolean {
  return (
    Math.abs(a.l - b.l) < 1e-6 &&
    Math.abs(a.c - b.c) < 1e-6 &&
    (a.c < 1e-5 || circularHueDistance(a.h, b.h) < 1e-4)
  )
}

/**
 * The palette without this side's adjustment. A shade the user edited after the
 * adjustment keeps the edit and becomes the new starting point.
 */
export function withoutEnd(palette: ReadonlyPalette, state: EndSideState): { base: Palette; origin: ShadeColors } {
  const base = clonePalette(palette)
  const origin: ShadeColors = { ...state.origin }
  for (const shade of SHADE_NAMES) {
    const before = origin[shade]
    if (!before) continue
    const written = state.written[shade]
    if (written && sameColor(palette[shade], written)) base[shade] = { ...before }
    else origin[shade] = { ...palette[shade] }
  }
  return { base, origin }
}

export function applyEnd(
  side: EndSide,
  palette: ReadonlyPalette,
  state: EndSideState,
  patch: EndPatch,
  anchor: Shade,
): { palette: Palette; state: EndSideState } {
  const tail = endTail(side, anchor)
  if (!tail.length) return { palette: clonePalette(palette), state }
  const next = { ...state, ...patch }
  const { base, origin } = withoutEnd(palette, state)
  for (const shade of tail) origin[shade] ??= { ...base[shade] }

  const end = END_SHADE[side]
  const keep = next.chroma === null || base[end].c < 1e-6 ? 1 : Math.min(1, next.chroma / base[end].c)
  const lightness = next.lightness ?? base[end].l
  const options: PaletteEndOptions =
    side === 'dark'
      ? { light: { lightness: base[50].l, tintRetention: 1 }, dark: { lightness, tintRetention: keep }, spread: tail.length }
      : { light: { lightness, tintRetention: keep }, dark: { lightness: base[950].l, tintRetention: 1 }, spread: tail.length }
  const adjusted = adjustPaletteEnds(base, options)

  const result = clonePalette(base)
  const written: ShadeColors = {}
  for (const shade of tail) {
    result[shade] = { ...adjusted[shade] }
    written[shade] = { ...adjusted[shade] }
  }
  if (!isAdjusted(next)) return { palette: result, state: EMPTY_SIDE }
  return { palette: result, state: { chroma: next.chroma, lightness: next.lightness, origin, written } }
}
