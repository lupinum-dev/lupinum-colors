import { shallowRef, watch } from 'vue'
import { historyIndex, undo } from './palette-store'

interface ToastAction {
  label: string
  run: () => void
}
interface Toast {
  id: number
  message: string
  action?: ToastAction
  historyIndex?: number
}
export const toast = shallowRef<Toast | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let nextId = 0

export function dismissToast(): void {
  clearTimeout(timer)
  toast.value = null
}
export function showToast(message: string, action?: ToastAction): void {
  dismissToast()
  toast.value = { id: ++nextId, message, action }
  timer = setTimeout(dismissToast, action ? 8000 : 3800)
}

watch(
  historyIndex,
  (index) => {
    if (toast.value?.historyIndex !== undefined && toast.value.historyIndex !== index)
      dismissToast()
  },
  { flush: 'sync' },
)

export function showRegenerationToast(replaced: number): void {
  const index = historyIndex.value
  showToast(
    `New scale generated. ${replaced} changed ${replaced === 1 ? 'shade was' : 'shades were'} replaced.`,
    {
      label: 'Undo',
      run: () => {
        if (historyIndex.value === index) undo()
      },
    },
  )
  toast.value = { ...toast.value!, historyIndex: index }
}
