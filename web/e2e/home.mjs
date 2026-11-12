// US-48 in headless Chrome: the home page sends a class code to its class and the teacher password to the teacher
// page. The API is mocked here. Run: npm run dev (in web/), then node e2e/home.mjs
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'

const APP = (process.env.APP ?? 'http://127.0.0.1:5173/').replace(/\/$/, '')
const CHROME =
  process.env.CHROME ??
  { win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe', darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }[process.platform] ??
  '/usr/bin/google-chrome'

const browser = await puppeteer.launch({ executablePath: CHROME })
const page = await browser.newPage()
page.on('pageerror', (err) => { throw err })
await page.setRequestInterception(true)
page.on('request', (req) => {
  const path = new URL(req.url()).pathname
  const json = (status, body) => req.respond({ status, contentType: 'application/json', body: JSON.stringify(body) })
  if (path === '/courses/FJ65HA') return json(200, { title: 'Lecture 21-22', join_code: 'FJ65HA', objectives: [] })
  if (path.startsWith('/courses/')) return json(404, { error: { message: 'no class with that code' } })
  if (path === '/teacher/courses') {
    return req.headers().authorization === 'Bearer right-password'
      ? json(200, { courses: [] }) : json(401, { error: { message: 'wrong or missing teacher password' } })
  }
  req.continue()
})
const text = () => page.evaluate(() => document.body.innerText)
const waitText = (s) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 8000 }, s)
  .catch(async () => { throw new Error(`waiting for "${s}" but the page says: ${await text()}`) })
const fill = async (id, value) => {
  await page.$eval(`#${id}`, (el) => { el.value = '' })
  await page.type(`#${id}`, value)
}
const open = async () => {
  await page.goto(`${APP}/home.html`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle0' })
}

await open()
assert.ok((await text()).includes('Join a class'))
assert.ok((await text()).includes('Teacher sign in'))
assert.ok(await page.$('a[href="/index.html"]'), 'links to the biology study app')

// Unknown class code: stays on the home page with a message.
await fill('class-code', 'zzzzzz')
await page.click('#join')
await waitText('No class has the code ZZZZZZ')
assert.match(page.url(), /home\.html/)

// A real class code (any case) opens that class.
await fill('class-code', 'fj65ha')
await Promise.all([page.waitForNavigation(), page.click('#join')])
assert.match(page.url(), /\/class\.html#FJ65HA$/)

// Wrong teacher password: message, no navigation, nothing saved.
await open()
await fill('teacher-password', 'nope')
await page.click('#sign-in')
await waitText('That password isn’t right')
assert.equal(await page.evaluate(() => localStorage.getItem('clipcademy-teacher-token')), null)

// Right password: teacher page, already signed in.
await fill('teacher-password', 'right-password')
await Promise.all([page.waitForNavigation(), page.click('#sign-in')])
assert.match(page.url(), /\/teach\.html$/)
assert.equal(await page.evaluate(() => localStorage.getItem('clipcademy-teacher-token')), 'right-password')

await browser.close()
console.log('home: all checks passed')
