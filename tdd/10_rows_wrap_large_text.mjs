// At the largest text size, a home row's action button wraps below the label instead of
// being pushed off a phone screen.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { REPO, newPage } from './web.mjs'

const css = await readFile(path.join(REPO, 'web', 'src', 'style.css'), 'utf8')
const { page, close } = await newPage()
await page.setViewport({ width: 320, height: 640, isMobile: true })
await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${css} html { font-size: ${process.env.TEXT_SIZE ?? '200%'} }</style>
  <main id="app"><section><h2>DNA replication</h2><ul class="list">
    <li class="objective"><div><p class="row-title">Synthesis direction and the primer requirement</p>
    <p class="row-sub">Not started</p></div><button type="button" class="primary">Start</button></li>
  </ul></section></main>`)
const { right, width } = await page.evaluate(() => ({
  right: document.querySelector('.objective button').getBoundingClientRect().right,
  width: document.documentElement.clientWidth,
}))
await close()
assert.ok(right <= width, `Start button ends at ${right}px on a ${width}px screen`)
console.log('ok')
