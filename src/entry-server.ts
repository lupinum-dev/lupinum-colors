import { renderToString } from '@vue/server-renderer'
import { createSSRApp } from 'vue'
import App from './App.vue'

export async function render(): Promise<string> {
  return renderToString(createSSRApp(App))
}
