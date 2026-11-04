// Heartbeat carry-over across a reload, in headless Chrome. Same setup as run.mjs:
//   CLIPCADEMY_BUILD_IDS=study-3 CLIPCADEMY_ADMIN_TOKEN=t CLIPCADEMY_DB=/tmp/e2e.db python learning/app.py
//   npm run dev
// Then: node e2e/heartbeat.mjs. The page clock runs at 4x, so 30 s of page time takes 7.5 s.
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'

const APP = process.env.APP ?? 'http://127.0.0.1:5173/'
const CHROME =
  process.env.CHROME ??
  { win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe', darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }[process.platform] ??
  '/usr/bin/google-chrome'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: CHROME })
const page = await browser.newPage()
await page.evaluateOnNewDocument(() => {
  const realNow = Date.now.bind(Date)
  const start = realNow()
  Date.now = () => start + (realNow() - start) * 4
})
const sent = []
await page.setRequestInterception(true)
page.on('request', (req) => {
  if (new URL(req.url()).pathname === '/events' && req.method() === 'POST') sent.push(JSON.parse(req.postData()))
  req.continue()
})
const beats = () => sent.filter((e) => e.event_name === 'heartbeat').length

await page.goto(APP, { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForSelector('#code')
await page.type('#code', 'P01')
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Continue').click())
await page.waitForFunction(() => document.body.innerText.includes('Which topics are on your exam?'), { timeout: 8000 })

await wait(5000) // ~20 s of page time on screen
assert.equal(beats(), 0, 'no heartbeat before 30 s')
await page.reload({ waitUntil: 'networkidle0' }) // a refresh must not throw away those ~20 s
await wait(3500) // ~14 s more: ~34 s on screen in total across the two loads
assert.equal(beats(), 1, `the seconds before the refresh carried over (got ${beats()} heartbeats)`)
console.log('PASS heartbeat: on-screen time carries over a refresh')

await browser.close()
