<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import ProductGuide from './components/ProductGuide.vue'
import SourceBar from './components/SourceBar.vue'
import ContrastSection from './components/ContrastSection.vue'
import PalettePreview from './components/PalettePreview.vue'
import EndAdjustments from './components/EndAdjustments.vue'
import CurveLanes from './components/CurveLanes.vue'
import ScaleStrip from './components/ScaleStrip.vue'
import ShadeBar from './components/ShadeBar.vue'
import AppToast from './components/AppToast.vue'
import {
  generate,
  lastResult,
  undo,
  redo,
  canUndo,
  canRedo,
  shareLoadError,
} from './app/palette-store'
import { showToast } from './app/toast'
if (!lastResult.value) generate()
const isDark = ref(true)
const hoverCol = ref(-1)
function toggleTheme(): void {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light'
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}
function moveToSection(id: 'main-content' | 'how-it-works'): void {
  const section = document.getElementById(id)
  if (!section) return
  section.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })
  if (id === 'main-content') section.focus({ preventScroll: true })
  else document.getElementById('guide-title')?.focus({ preventScroll: true })
}
function shortcut(event: KeyboardEvent): void {
  const target = event.target
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest('textarea, select, input:not([type="range"]):not([type="color"])'))
  )
    return
  if (!event.ctrlKey && !event.metaKey) return
  const key = event.key.toLowerCase()
  if (key === 'z' && !event.shiftKey && canUndo.value) {
    event.preventDefault()
    undo()
  } else if (((key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey)) && canRedo.value) {
    event.preventDefault()
    redo()
  }
}
onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  if (shareLoadError.value) showToast(shareLoadError.value)
  window.addEventListener('keydown', shortcut)
})
onBeforeUnmount(() => window.removeEventListener('keydown', shortcut))
</script>
<template>
  <a
    class="skip-link wb-sr-only"
    href="#main-content"
    @click.prevent="moveToSection('main-content')"
    >Skip to palette generator</a
  >
  <main id="main-content" class="workbench-page page" tabindex="-1">
    <h1 class="wb-sr-only">Tailwind shade generator</h1>
    <div class="wrap">
      <div class="app">
        <SourceBar :is-dark="isDark" @toggle-theme="toggleTheme" />
        <div class="work">
          <div class="main">
            <ScaleStrip @hover="hoverCol = $event" /><ShadeBar /><CurveLanes
              :hover-col="hoverCol"
            />
          </div>
          <aside class="side" aria-label="Preview and adjustments">
            <PalettePreview /><EndAdjustments />
          </aside>
        </div>
        <ContrastSection />
        <footer class="app-foot">
          <span
            >Calibrated with the color definitions of Tailwind CSS
            {{ lastResult?.reference.tailwindVersion }}. Lupinum Colors is independent and is not
            affiliated with or endorsed by Tailwind Labs.</span
          ><a href="#how-it-works" @click.prevent="moveToSection('how-it-works')">How it works</a>
        </footer>
      </div>
      <ProductGuide id="how-it-works" :tailwind-version="lastResult?.reference.tailwindVersion" />
    </div>
    <AppToast />
  </main>
</template>

<style scoped>
.app {
  position: relative;
  background: var(--wb-panel);
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-app);
  box-shadow: var(--wb-shadow);
}
.app-in {
  position: relative;
}
.boot {
  padding: 48px 24px;
  color: var(--wb-fg-2);
}

.work {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
}
.main {
  display: grid;
  gap: 20px;
  align-content: start;
  padding: 16px;
  min-width: 0;
}
.side {
  display: grid;
  gap: 24px;
  align-content: start;
  padding: 16px;
  border-left: 1px solid var(--wb-line);
  min-width: 0;
}
.page {
  padding-inline: clamp(16px, 3vw, 32px);
  padding-block: 24px 64px;
}
.wrap {
  max-width: 1480px;
  margin-inline: auto;
}
.app-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 12px 16px;
  border-top: 1px solid var(--wb-line);
  color: var(--wb-fg-3);
  font-size: 12px;
}
.app-foot a {
  color: var(--wb-fg-2);
  text-underline-offset: 2px;
}
.skip-link:focus {
  position: fixed;
  top: 8px;
  left: 8px;
  width: auto;
  height: auto;
  clip: auto;
  z-index: 100;
  padding: 8px;
  background: var(--wb-panel);
}
@media (max-width: 1180px) {
  .work {
    grid-template-columns: minmax(0, 1fr) 290px;
  }
}
@media (max-width: 880px) {
  .work {
    grid-template-columns: minmax(0, 1fr);
  }
  .side {
    border-left: 0;
    border-top: 1px solid var(--wb-line);
  }
}
</style>
