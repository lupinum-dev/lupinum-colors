<script setup lang="ts">
import ProductGuide from './components/ProductGuide.vue'
import { generate, lastResult } from './app/palette-store'
generate()
</script>
<template>
  <main id="main-content">
    <div class="app"></div>
    <ProductGuide :tailwind-version="lastResult?.reference.tailwindVersion" />
  </main>
</template>
