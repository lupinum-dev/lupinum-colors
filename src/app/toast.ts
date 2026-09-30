import { shallowRef } from 'vue'

interface ToastAction {
  label: string
  run: () => void
}
interface Toast {
  id: number
  message: string
  action?: ToastAction
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
