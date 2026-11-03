// Shared setup for the web tests: load web/src modules from $REPO through Vite (they use
// import.meta.env and import.meta.glob), with just enough browser globals and a fake clock.
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REPO = path.resolve(process.env.REPO ?? path.join(HERE, '..'))
const NM = path.join(HERE, '..', 'web', 'node_modules') // tooling from this checkout; old commits have no node_modules
const { createServer } = await import(pathToFileURL(path.join(NM, 'vite', 'dist', 'node', 'index.js')))

export const CHROME =
  process.env.CHROME ??
  { win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe', darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }[process.platform] ??
  '/usr/bin/google-chrome'

const viteOptions = (extra) => ({
  root: path.join(REPO, 'web'),
  configFile: false,
  logLevel: 'silent',
  ...extra,
  server: { hmr: false, watch: null, fs: { allow: [REPO] }, ...extra.server },
})

// Fresh window/document/localStorage. Pass the same `store` Map again to simulate a page refresh.
export function browser(store = new Map()) {
  const win = new EventTarget()
  const doc = new EventTarget()
  doc.visibilityState = 'visible'
  Object.assign(globalThis, {
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    addEventListener: win.addEventListener.bind(win),
    dispatchEvent: win.dispatchEvent.bind(win),
    document: doc,
    location: { hash: '' },
  })
  return { store, win, doc, saved: () => JSON.parse(store.get('clipcademy') ?? '{}') }
}

// Records fetch calls; `reply(url, init)` returns { status, body }.
export function fakeFetch(reply = () => ({ status: 201, body: {} })) {
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method, body: init.body && JSON.parse(init.body) })
    const { status, body } = reply(url, init)
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }
  return calls
}

// Date.now and setInterval under test control. Install after createServer so Vite keeps real timers.
export function fakeClock() {
  let now = Date.parse('2026-11-03T12:00:00Z')
  const timers = []
  Date.now = () => now
  globalThis.setInterval = (fn, ms) => timers.push({ fn, ms, next: now + ms })
  return {
    timers,
    async advance(ms) {
      const end = now + ms
      for (;;) {
        const t = timers.filter((t) => t.next <= end).sort((a, b) => a.next - b.next)[0]
        if (!t) break
        now = t.next
        t.next += t.ms
        t.fn()
        await settle()
      }
      now = end
    },
  }
}

export const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
}

// Loads web/src/<rel> as the browser would see it (DATA_MODE live unless env says otherwise).
// Each call is a fresh module graph, like a page load; `other(rel)` imports a sibling from the same graph.
export async function load(rel, { clock, ...env } = {}) {
  Object.assign(process.env, env)
  const server = await createServer(viteOptions({ appType: 'custom', server: { middlewareMode: true } }))
  const other = (r) => server.ssrLoadModule(`/src/${r}`)
  const fake = clock?.() // after the server exists, before the module's top level runs
  return { mod: await other(rel), other, clock: fake, close: () => server.close() }
}

// A blank headless Chrome page (phone-sized). Returns { page, close }.
export async function newPage() {
  const { default: puppeteer } = await import(pathToFileURL(path.join(NM, 'puppeteer-core', 'lib', 'puppeteer', 'puppeteer-core.js')))
  const chrome = await puppeteer.launch({ executablePath: CHROME, args: process.env.CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : [] })
  const page = await chrome.newPage()
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  return { page, close: () => chrome.close() }
}

// The real app in samples mode (no Python service needed). Returns { page, url, close }.
export async function openApp() {
  process.env.VITE_DATA_MODE = 'samples'
  const server = await createServer(viteOptions({ server: { host: '127.0.0.1', port: 0 } }))
  await server.listen()
  const { page, close } = await newPage()
  return { page, url: server.resolvedUrls.local[0], close: async () => (await close(), await server.close()) }
}
