import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const templatePath = new URL('../dist/index.html', import.meta.url)
const rendererPath = new URL('../dist-ssr/entry-server.js', import.meta.url)
const marker = '<div id="app"><!--app-html--></div>'

const [{ render }, template] = await Promise.all([
  import(pathToFileURL(rendererPath.pathname).href),
  readFile(templatePath, 'utf8'),
])

if (!template.includes(marker)) {
  throw new Error(`Unable to pre-render: ${marker} is missing from dist/index.html.`)
}

const appHtml = await render()
const output = template.replace(marker, `<div id="app" data-prerendered="true">${appHtml}</div>`)

await writeFile(templatePath, output)
console.log(`Pre-rendered Lupinum Colors (${appHtml.length.toLocaleString()} HTML characters).`)
