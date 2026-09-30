<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import ProductGuide from './components/ProductGuide.vue'
import SourceBar from './components/SourceBar.vue'
import AppToast from './components/AppToast.vue'
import { generate, lastResult, undo, redo, canUndo, canRedo, restoreSharedPaletteFromHash, shareLoadError } from './app/palette-store'
import { showToast } from './app/toast'
if (!lastResult.value) generate()
const isDark = ref(true)
function toggleTheme(): void {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light'
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}
function moveToSection(id: 'main-content' | 'how-it-works'): void {
  const section = document.getElementById(id)
  if (!section) return
  section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  if (id === 'main-content') section.focus({ preventScroll: true })
  else document.getElementById('guide-title')?.focus({ preventScroll: true })
}
function shortcut(event: KeyboardEvent): void {
  const target = event.target
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('textarea, select, input:not([type="range"]):not([type="color"])'))) return
  if (!event.ctrlKey && !event.metaKey) return
  const key = event.key.toLowerCase()
  if (key === 'z' && !event.shiftKey && canUndo.value) { event.preventDefault(); undo() }
  else if (((key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey)) && canRedo.value) { event.preventDefault(); redo() }
}
onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  restoreSharedPaletteFromHash(window.location.hash)
  if (shareLoadError.value) showToast(shareLoadError.value)
  window.addEventListener('keydown', shortcut)
})
onBeforeUnmount(() => window.removeEventListener('keydown', shortcut))
</script>
<template>
  <a class="skip-link wb-sr-only" href="#main-content" @click.prevent="moveToSection('main-content')">Skip to palette generator</a>
  <main id="main-content" class="workbench-page page" tabindex="-1">
    <h1 class="wb-sr-only">Tailwind shade generator</h1>
    <div class="wrap"><div class="app"><SourceBar :is-dark="isDark" @toggle-theme="toggleTheme" /></div>
      <ProductGuide id="how-it-works" :tailwind-version="lastResult?.reference.tailwindVersion" />
    </div><AppToast />
  </main>
</template>

<style scoped>

.app { position: relative; background: var(--wb-panel); border: 1px solid var(--wb-line); border-radius: var(--wb-r-app); box-shadow: var(--wb-shadow); }
.app-in { position: relative; }
.boot { padding: 48px 24px; color: var(--wb-fg-2); }


.work { display: grid; grid-template-columns: minmax(0, 1fr) 320px; }
.main { display: grid; gap: 20px; align-content: start; padding: 16px; min-width: 0; }
.side { display: grid; gap: 24px; align-content: start; padding: 16px; border-left: 1px solid var(--wb-line); min-width: 0; }
.wb-row { display: grid; grid-template-columns: 112px minmax(0, 1fr); }
.wb-gutter { display: flex; flex-direction: column; gap: 2px; padding-right: 12px; min-width: 0; }
.wb-lbl { font-weight: 600; font-size: 13px; }
.wb-sub { color: var(--wb-fg-3); font-size: 12px; }
h2.wb-h { margin: 0; font-size: 13px; font-weight: 600; }
.wb-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.wb-grow { flex: 1; }

.page { padding-inline: clamp(16px, 3vw, 32px); padding-block: 24px 64px; }
.wrap { max-width: 1480px; margin-inline: auto; }
.app-foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; padding: 12px 16px; border-top: 1px solid var(--wb-line); color: var(--wb-fg-3); font-size: 12px; }
.app-foot a { color: var(--wb-fg-2); text-underline-offset: 2px; }.skip-link:focus { position: fixed; top: 8px; left: 8px; width: auto; height: auto; clip: auto; z-index: 100; padding: 8px; background: var(--wb-panel); }
</style>
