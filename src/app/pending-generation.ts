let timer: ReturnType<typeof setTimeout> | undefined

export function cancelPendingGeneration(): void {
  clearTimeout(timer)
  timer = undefined
}

export function scheduleGeneration(generate: () => void): void {
  cancelPendingGeneration()
  timer = setTimeout(() => {
    timer = undefined
    generate()
  }, 260)
}
