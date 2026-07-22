import type { OverlayLine, OverlayMarker } from './palette-store'

export const OVERLAY_DASH: Record<OverlayLine, string> = {
  dash: '7 5',
  dot: '2 5',
  'dash-dot': '10 4 2 4',
  'long-dash': '14 7',
}

export const OVERLAY_LINE_OPTIONS: { value: OverlayLine; label: string }[] = [
  { value: 'dash', label: 'dash' },
  { value: 'dot', label: 'dot' },
  { value: 'dash-dot', label: 'dash · dot' },
  { value: 'long-dash', label: 'long dash' },
]

export const OVERLAY_MARKER_OPTIONS: OverlayMarker[] = ['diamond', 'square', 'triangle', 'circle']

export function trianglePoints(x: number, y: number, radius = 4): string {
  return `${x},${y - radius} ${x - radius * 0.93},${y + radius * 0.78} ${x + radius * 0.93},${y + radius * 0.78}`
}
