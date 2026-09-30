import { normalizeHue } from '../color'
import type { OklchColor } from '../types'

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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export const OKLCH_CHANNELS: readonly Channel[] = [
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
  ]
