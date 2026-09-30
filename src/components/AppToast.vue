<script setup lang="ts">
import { toast, dismissToast } from '@/app/toast'
function act(): void {
  toast.value?.action?.run()
  dismissToast()
}
</script>
<template>
  <div role="status" aria-live="polite" class="wb-sr-only">{{ toast?.message ?? '' }}</div>
  <Transition name="toast"
    ><div v-if="toast" :key="toast.id" class="toast">
      <span>{{ toast.message }}</span
      ><button v-if="toast.action" class="wb-btn sm" @click="act">{{ toast.action.label }}</button>
    </div></Transition
  >
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(560px, calc(100vw - 32px));
  padding: 10px 10px 10px 14px;
  border-radius: 10px;
  background: var(--wb-fg);
  color: var(--wb-on-fg);
  box-shadow: var(--wb-pop-shadow);
  font-size: 13px;
}
.toast .wb-btn {
  color: var(--wb-on-fg);
  background: color-mix(in oklch, var(--wb-on-fg) 14%, transparent);
  height: 28px;
}
.toast .wb-btn:hover {
  background: color-mix(in oklch, var(--wb-on-fg) 24%, transparent) !important;
}
.toast-enter-active {
  transition:
    opacity 180ms,
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-leave-active {
  transition:
    opacity 120ms,
    transform 120ms;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
