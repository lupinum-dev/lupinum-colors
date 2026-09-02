import { converter, type Color } from 'culori'
import { normalizeHue } from '../color'
import type { OklchColor } from '../types'

export type ChannelMode = 'oklch' | 'hsv' | 'hsl'

export interface Channel {
  key: string
  label: string
  name: string
  min: number
  max: number
  step: number
  format: (value: number) => string
  get: (color: OklchColor) => number
  set: (color: OklchColor, value: number) => OklchColor
}

const toHsv = converter('hsv')
const toHsl = converter('hsl')
const toOklch = converter('oklch')

function asCulori(color: OklchColor): Color {
  return { mode: 'oklch', l: color.l, c: color.c, h: color.h }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

type SrgbMode = 'hsv' | 'hsl'
type SrgbKey = 'h' | 's' | 'v' | 'l'

function readSrgb(color: OklchColor, mode: SrgbMode): Record<SrgbKey, number> {
  const converted = mode === 'hsv' ? toHsv(asCulori(color)) : toHsl(asCulori(color))
  const channels = converted as Partial<Record<SrgbKey, number>>
  return {
    h: normalizeHue(channels.h ?? color.h),
    s: clamp(channels.s ?? 0, 0, 1),
    v: clamp(channels.v ?? 0, 0, 1),
    l: clamp(channels.l ?? 0, 0, 1),
  }
}

function writeSrgb(color: OklchColor, mode: SrgbMode, key: SrgbKey, value: number): OklchColor {
  const current = readSrgb(color, mode)
  const next = { ...current, [key]: value }
  const source: Color =
    mode === 'hsv'
      ? { mode: 'hsv', h: next.h, s: next.s, v: next.v }
      : { mode: 'hsl', h: next.h, s: next.s, l: next.l }
  const back = toOklch(source)
  return {
    l: clamp(back?.l ?? color.l, 0, 1),
    c: Math.max(0, back?.c ?? 0),
    h: normalizeHue(back?.h ?? color.h),
  }
}

function srgbChannel(mode: SrgbMode, key: SrgbKey, label: string, name: string): Channel {
  const isHue = key === 'h'
  return {
    key,
    label,
    name,
    min: 0,
    max: isHue ? 360 : 1,
    step: isHue ? 0.1 : 0.001,
    format: (value) => (isHue ? `${value.toFixed(1)}°` : `${(value * 100).toFixed(1)}%`),
    get: (color) => readSrgb(color, mode)[key],
    set: (color, value) =>
      writeSrgb(color, mode, key, isHue ? normalizeHue(value) : clamp(value, 0, 1)),
  }
}

export const CHANNEL_MODES: Record<ChannelMode, Channel[]> = {
  oklch: [
    {
      key: 'l',
      label: 'L',
      name: 'Lightness',
      min: 0,
      max: 1,
      step: 0.001,
      format: (value) => `${(value * 100).toFixed(1)}%`,
      get: (color) => color.l,
      set: (color, value) => ({ ...color, l: clamp(value, 0, 1) }),
    },
    {
      key: 'c',
      label: 'C',
      name: 'Chroma',
      min: 0,
      max: 0.4,
      step: 0.001,
      format: (value) => value.toFixed(3),
      get: (color) => color.c,
      set: (color, value) => ({ ...color, c: Math.max(0, value) }),
    },
    {
      key: 'h',
      label: 'H',
      name: 'Hue',
      min: 0,
      max: 360,
      step: 0.1,
      format: (value) => `${value.toFixed(1)}°`,
      get: (color) => normalizeHue(color.h),
      set: (color, value) => ({ ...color, h: normalizeHue(value) }),
    },
  ],
  hsv: [
    srgbChannel('hsv', 'h', 'H', 'Hue'),
    srgbChannel('hsv', 's', 'S', 'Saturation'),
    srgbChannel('hsv', 'v', 'V', 'Value'),
  ],
  hsl: [
    srgbChannel('hsl', 'h', 'H', 'Hue'),
    srgbChannel('hsl', 's', 'S', 'Saturation'),
    srgbChannel('hsl', 'l', 'L', 'Lightness'),
  ],
}
