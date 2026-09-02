import { createApp, createSSRApp } from 'vue'
import App from './App.vue'
import { restoreSharedPaletteFromHash } from './app/palette-store'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import './style.css'

const root = document.querySelector<HTMLElement>('#app')

if (!root) throw new Error('Unable to start Lupinum Colors: #app was not found.')

const shareState = restoreSharedPaletteFromHash(window.location.hash)
const application =
  root.dataset.prerendered === 'true' && shareState !== 'restored'
    ? createSSRApp(App)
    : createApp(App)
application.mount(root)
