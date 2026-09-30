<script setup lang="ts">
import { computed } from 'vue'
import { displayShades } from '@/app/palette-store'
const uiVars = computed(() => Object.fromEntries(displayShades.value.map(e => [`--c${e.shade}`,e.css])))
const bars=[{h:42,l:200,d:800},{h:58,l:300,d:700},{h:50,l:400,d:600},{h:74,l:500,d:500},{h:66,l:600,d:400},{h:92,l:700,d:300}]
</script>
<template>
<section class="previews" aria-label="Preview" :style="uiVars"><figure v-for="mode in ['light','dark']" :key="mode" class="ui-fig"><figcaption>{{ mode==='light'?'Light':'Dark' }}</figcaption><div class="ui" :class="mode" inert>
  <div class="ui-nav"><span class="ui-logo"></span><b>Canopy</b><span class="on">Projects</span><span>Team</span></div><div class="ui-title"><strong>Riverbank restoration</strong><span class="ui-badge">On track</span></div>
  <div class="ui-card"><div class="ui-bars"><i v-for="(bar,i) in bars" :key="i" :style="{height:`${bar.h}%`,background:`var(--c${mode==='light'?bar.l:bar.d})`}"></i></div><p>Next survey on 14 October. <span class="ui-link">See the plan</span></p><div class="ui-actions"><span class="ui-input">field@canopy.example</span><span class="ui-btn">Save</span></div></div>
</div></figure></section>
</template>

<style scoped>

.previews { display: grid; gap: 10px; }
.ui-fig { margin: 0; display: grid; gap: 6px; min-width: 0; }
.ui-fig figcaption { font-size: 12px; color: var(--wb-fg-2); font-weight: 500; }
.ui { border-radius: 10px; overflow: hidden; border: 1px solid var(--wb-line); font-size: 11.5px; padding: 12px; display: grid; gap: 8px; }
.ui.light { background: var(--c50); color: var(--c900); }
.ui.dark { background: var(--c950); color: var(--c100); }
.ui-nav { display: flex; align-items: center; gap: 8px; }
.ui-logo { width: 14px; height: 14px; border-radius: 4px; }
.ui.light .ui-logo { background: var(--c600); }
.ui.dark .ui-logo { background: var(--c500); }
.ui-nav b { font-size: 12px; margin-right: auto; }
.ui-nav span { padding-bottom: 1px; border-bottom: 2px solid transparent; opacity: .85; }
.ui-nav span.on { opacity: 1; font-weight: 600; }
.ui.light .ui-nav span.on { border-color: var(--c600); }
.ui.dark .ui-nav span.on { border-color: var(--c400); }
.ui-title { display: flex; align-items: center; gap: 6px; }
.ui-title strong { font-size: 13px; letter-spacing: -0.01em; }
.ui-badge { padding: 1px 7px; border-radius: 99px; font-size: 10.5px; font-weight: 600; }
.ui.light .ui-badge { background: var(--c100); color: var(--c800); }
.ui.dark .ui-badge { background: var(--c800); color: var(--c200); }
.ui-card { border-radius: 7px; padding: 10px; display: grid; gap: 8px; }
.ui.light .ui-card { background: #fff; color: oklch(30% 0 0); box-shadow: 0 1px 2px oklch(0% 0 0 / 0.08); }
.ui.dark .ui-card { background: var(--c900); color: oklch(88% 0 0); border: 1px solid var(--c800); }
.ui-bars { display: flex; align-items: flex-end; gap: 5px; height: 34px; }
.ui-bars i { flex: 1; border-radius: 3px 3px 0 0; }
.ui-card p { margin: 0; line-height: 1.45; }
.ui.light .ui-link { color: var(--c600); }
.ui.dark .ui-link { color: var(--c400); }
.ui-link { text-decoration: underline; text-underline-offset: 2px; font-weight: 500; }
.ui-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ui-input { flex: 1; min-width: 90px; height: 26px; display: flex; align-items: center; padding: 0 8px; border-radius: 5px; font-family: var(--wb-mono); font-size: 10.5px; }
.ui.light .ui-input { border: 1px solid oklch(85% 0 0); box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px var(--c500); }
.ui.dark .ui-input { border: 1px solid oklch(40% 0 0); box-shadow: 0 0 0 2px var(--c900), 0 0 0 3.5px var(--c500); background: oklch(0% 0 0 / 0.2); }
.ui-btn { height: 26px; display: inline-flex; align-items: center; padding: 0 10px; border-radius: 5px; font-weight: 600; }
.ui.light .ui-btn { background: var(--c600); color: #fff; }
.ui.dark .ui-btn { background: var(--c500); color: #fff; }

@media(max-width:880px) { .previews {grid-template-columns:repeat(auto-fit,minmax(240px,1fr));} }
</style>
