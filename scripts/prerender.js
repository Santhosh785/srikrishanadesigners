// Static Site Generation: renders the app to HTML at build time and injects it
// into dist/index.html so the page ships with its content already in place.
import { readFile, writeFile, rm } from 'node:fs/promises'

const PLACEHOLDER = '<!--app-html-->'
const templatePath = new URL('../dist/index.html', import.meta.url)
const ssrDir = new URL('../dist-ssr/', import.meta.url)

const template = await readFile(templatePath, 'utf-8')
if (!template.includes(PLACEHOLDER)) {
  throw new Error(`Placeholder ${PLACEHOLDER} not found in dist/index.html`)
}

const { render } = await import(new URL('entry-server.js', ssrDir))
await writeFile(templatePath, template.replace(PLACEHOLDER, render()))
await rm(ssrDir, { recursive: true, force: true })

console.log('Prerendered dist/index.html')
