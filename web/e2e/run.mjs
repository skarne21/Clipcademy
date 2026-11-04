// End-to-end run of Member3_SPEC test cases 1–14 in headless Chrome.
// Needs, in two terminals:
//   CLIPCADEMY_BUILD_IDS=dev CLIPCADEMY_ADMIN_TOKEN=t CLIPCADEMY_DB=/tmp/e2e.db python learning/app.py
//   npm run dev   (or: npm run build && npm run preview -- --port 5173)
// Then: npm run e2e. Use a scratch CLIPCADEMY_DB: this writes attempts and events.
// /video-jobs is faked per case (VIDEO=real uses the server's own answer for the first case only).
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const APP = process.env.APP ?? 'http://127.0.0.1:5173/'
const API = process.env.API ?? 'http://127.0.0.1:8000'
const TOKEN = process.env.ADMIN_TOKEN ?? 't'
const CHROME =
  process.env.CHROME ??
  { win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe', darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }[process.platform] ??
  '/usr/bin/google-chrome'
const clip = await readFile(new URL('./clip.mp4', import.meta.url))

const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required', ...(process.env.CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : [])] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })

const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))

// ---- network control ----
const log = { attempts: [], events: [], videoPosts: 0, questionBodies: [] }
let video = 'broken' // real | broken (clip URL 404s) | playable | slow
let eventsDown = false
let attemptHook = null
let jobPolls = 0
await page.setRequestInterception(true)
page.on('request', async (req) => {
  const url = new URL(req.url())
  if (url.pathname === '/media/e2e.mp4') return req.respond({ contentType: 'video/mp4', body: clip })
  if (url.pathname === '/attempts' && req.method() === 'POST') {
    log.attempts.push(JSON.parse(req.postData()))
    if (attemptHook) return attemptHook(req)
  }
  if (url.pathname === '/events' && req.method() === 'POST') {
    if (eventsDown) return req.abort('internetdisconnected')
    log.events.push(JSON.parse(req.postData()))
  }
  if (url.pathname.startsWith('/video-jobs')) {
    if (req.method() === 'POST') log.videoPosts++
    if (video === 'real') return req.continue()
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData())
      if (video === 'slow') await new Promise((r) => setTimeout(r, 3000))
      return req.respond({ status: 202, contentType: 'application/json', body: JSON.stringify({ job_id: `job-${body.variant_id}`, status: 'queued' }) })
    }
    jobPolls++
    const video_url = video === 'playable' ? '/media/e2e.mp4' : '/media/missing.mp4'
    return req.respond({ contentType: 'application/json', body: JSON.stringify({ job_id: 'job', status: 'ready', variant_id: 'x', video_url, transcript: 'Test transcript.', source: 'prerendered' }) })
  }
  req.continue()
})
page.on('response', async (res) => {
  if (new URL(res.url()).pathname.startsWith('/questions/')) log.questionBodies.push(await res.text().catch(() => ''))
})

// ---- helpers ----
const text = () => page.evaluate(() => document.body.innerText)
const waitText = (s, timeout = 8000) => page.waitForFunction((s) => document.body.innerText.includes(s), { timeout }, s)
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('clipcademy')))
const queueEmpty = () => page.waitForFunction(() => JSON.parse(localStorage.getItem('clipcademy')).event_queue.length === 0, { timeout: 8000 })
async function click(label) {
  // Home re-renders when /topics arrives; a found button can be replaced before the click lands.
  for (let tries = 3; ; tries--) {
    const el = await page.waitForFunction(
      (label) => [...document.querySelectorAll('button, a, label')].find((e) => e.innerText.trim() === label && !e.disabled),
      { timeout: 8000 },
      label,
    )
    try {
      return await el.click()
    } catch (err) {
      if (tries === 1 || !/detached/.test(err.message)) throw err
    }
  }
}
const pickChoice = (id) => page.click(`input[value="${id}"]`)
async function answer(id, expect) {
  await page.waitForSelector(`input[value="${id}"]`)
  await pickChoice(id)
  await click('Submit')
  await waitText(expect)
}
const hash = () => page.evaluate(() => location.hash)
const ok = (name) => console.log('PASS', name)

// 1. first open
await page.goto(APP, { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload()
await waitText('Participant code')
await click('Continue')
await waitText('Enter the participant code')
assert.equal(await page.$eval('#code', (e) => e.getAttribute('aria-invalid')), 'true')
await page.type('#code', '  p01 ')
await click('Continue')
await waitText('Which topics are on your exam?')
assert.equal((await store()).participant_id, 'P01')
ok('1 participant code')

// 2. picker
const rows = await page.$$eval('.row', (r) => r.map((x) => x.innerText))
assert.equal(rows.length, 4)
// validation build: replication and DNA repair available, the other two coming soon
assert.deepEqual(rows.map((r) => r.endsWith('Coming soon')), [false, false, true, true])
await click('DNA replication\nReady to review')
await click('Translation\nComing soon')
assert.deepEqual((await store()).selected_topic_ids, ['dna_replication', 'translation'])
await click('Continue')
await waitText('Your review')
let t = await text()
assert.match(t, /Not started/)
assert.match(t, /Coming soon\. This topic/)
assert.doesNotMatch(t.split('Translation')[1], /Complete|Start|Resume/)
assert.match(t, /P01/)
ok('2 coming-soon topics selectable, never startable')

// 9. A missing clip, then retry.
await click('Start')
await waitText("The clip couldn't load.")
assert.match(await hash(), /#\/lesson\/synthesis_direction_and_primer/)
video = 'broken'
await click('Retry')
await waitText("The clip couldn't load.")
assert.ok(jobPolls >= 1, 'polled the job')
ok('9a lesson clip failure + retry')

// playback: transcript, disclosure, video_started / video_completed
video = 'playable'
await click('Retry')
await page.waitForSelector('video')
await waitText('Test transcript.')
assert.match(await text(), /Previously rendered/)
await page.$eval('video', (v) => {
  v.muted = true
  return v.play()
})
await page.waitForFunction(() => document.querySelector('video').ended, { timeout: 10000 })
await queueEmpty()
const played = log.events.filter((e) => e.event_name.startsWith('video_'))
assert.deepEqual(played.map((e) => [e.event_name, e.variant_id]), [['video_started', 'initial'], ['video_completed', 'initial']])
ok('video plays; transcript, disclosure, video_started and video_completed sent')
video = 'broken'

// 3. replication q1=B, q2=A -> complete. 14: nothing before submit; 8: double tap
await click('Answer the question')
await page.waitForSelector('input[value="B"]')
assert.equal(await page.$eval('button[type=submit]', (b) => b.disabled), true)
assert.doesNotMatch(await text(), /Correct|Not quite/)
assert.ok(log.questionBodies.every((b) => !/correct|feedback|misconception/i.test(b)), 'question response leaks nothing')
ok('14 nothing shown before submit, question response clean')
await pickChoice('B')
const before = log.attempts.length
await page.$eval('button[type=submit]', (b) => {
  b.click()
  b.click()
})
await waitText('Correct')
assert.equal(log.attempts.length - before, 1)
ok('8 double tap sends one request')
await page.reload() // 6: refresh on feedback
await waitText('Next question')
await click('Next question')
await page.reload() // 6: refresh on question
await answer('A', 'Correct')
await click('See summary')
await waitText('Complete')
await page.reload() // 6: refresh on summary
await waitText('Complete')
await click('Return home')
await waitText('See summary')
assert.match(await text(), /Complete/)
ok('3 q1=B q2=A complete; 6 refresh keeps feedback/question/summary')

// 4. demo walkthrough: q1=B, q2=B, follow-up, r2=B. Starts like the scripted task: "Tap Restart" on home.
await click('See summary') // home's link still opens the summary
await waitText('Return home')
await click('Return home')
await click('Restart')
assert.match(await hash(), /#\/lesson\/synthesis_direction_and_primer/)
assert.equal((await store()).objectives.synthesis_direction_and_primer.attempts.length, 0)
await click('Answer the question')
await answer('B', 'Correct')
await click('Next question')
await answer('B', 'Not quite')
assert.doesNotMatch(await text(), /Primase makes/)
const vBefore = log.videoPosts
await click('Watch explanation')
assert.equal(await hash(), '#/followup')
await waitText('Your answer is saved.')
assert.equal(log.videoPosts - vBefore, 1)
await page.reload() // 6: refresh on follow-up
await click('Answer the question')
assert.match(await hash(), /rep-r2/)
await answer('B', 'Correct')
await click('See summary')
await waitText('Complete')
ok('4 wrong answer -> follow-up -> rep-r2 -> complete')

// 5. q1=A, r1=B, r3=B -> needs_review
await click('Restart')
await click('Answer the question')
await answer('A', 'Not quite')
await click('Watch explanation')
await click('Answer the question')
assert.match(await hash(), /rep-r1/)
await answer('B', 'Not quite')
await click('Watch explanation')
await click('Answer the question')
assert.match(await hash(), /rep-r3/)
await answer('B', 'Not quite')
await click('See summary')
await waitText('Go over these')
t = await text()
assert.match(t, /Needs review/)
assert.match(t, /DNA polymerase can't start a strand/)
ok('5 two follow-ups -> needs_review with review points')

// a stale link can't reopen an answered question
await page.goto(APP + '#/question/rep-q1')
await waitText('Go over these')
ok('stale link redirects to the saved step')

// 7. refresh while an attempt is in flight: the server stores it, the client never sees the reply
await click('Restart')
await click('Answer the question')
await page.waitForSelector('input[value="B"]')
attemptHook = async (req) => {
  attemptHook = null
  await fetch(`${API}/attempts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: req.postData() })
  req.abort('connectionreset')
}
await pickChoice('B')
await click('Submit')
await waitText("Couldn't send your answer")
const pending = (await store()).objectives.synthesis_direction_and_primer.pending_attempt
assert.ok(pending)
const n = log.attempts.length
await page.reload()
await waitText('Correct')
assert.equal(log.attempts.length, n + 1)
assert.equal(log.attempts.at(-1).attempt_id, pending.attempt_id)
assert.equal((await store()).objectives.synthesis_direction_and_primer.pending_attempt, null)
ok('7 refresh resends the same attempt_id once')

// 10. late clip response after leaving the lesson
await page.goto(APP + '#/home')
await click('Reset demo')
await click('Tap again to clear all progress')
await click('DNA replication\nReady to review')
await click('Continue')
video = 'slow'
await click('Start')
await waitText('Preparing your explanation')
await click('Back')
await waitText('Your review')
await new Promise((r) => setTimeout(r, 3500))
t = await text()
assert.match(t, /Your review/)
assert.doesNotMatch(t, /couldn't load|Transcript/)
video = 'broken'
ok('10 late clip response never replaces another screen')

// 11. events offline: student not blocked, event arrives later with original timestamp
eventsDown = true
await click('Resume')
await click('Answer the question')
await answer('B', 'Correct')
const qa = (await store()).event_queue.find((e) => e.event_name === 'question_answered')
assert.ok(qa, 'question_answered queued while offline')
eventsDown = false
await click('Next question') // next screen change flushes
await queueEmpty()
assert.equal(log.events.find((e) => e.event_id === qa.event_id).client_timestamp_utc, qa.client_timestamp_utc)
ok('11 offline events retried with original id and timestamp')

// 12. reset demo
await page.goto(APP + '#/home')
await click('Reset demo')
await click('Tap again to clear all progress')
await waitText('Which topics are on your exam?')
const s = await store()
assert.equal(s.participant_id, 'P01')
assert.deepEqual(s.objectives, {})
await queueEmpty()
assert.ok(log.events.some((e) => e.event_name === 'demo_reset'))
await page.reload()
await waitText('Which topics are on your exam?')
ok('12 reset keeps participant code, sends demo_reset')

// 13. events.csv, limited to this run's sessions
const csv = await (await fetch(`${API}/events.csv`, { headers: { Authorization: `Bearer ${TOKEN}` } })).text()
const sessions = new Set(log.events.map((e) => e.session_id))
const lines = csv.trim().split(/\r?\n/).slice(1).filter((l) => sessions.has(l.split(',')[2]))
assert.ok(lines.length > 0)
assert.ok(lines.every((l) => l.includes(',P01,') && l.endsWith(',ok')), 'every row has P01 and build_id_status ok')
const names = lines.map((l) => l.split(',')[3])
const uniqueAttempts = new Set(log.attempts.map((a) => a.attempt_id)).size
assert.equal(names.filter((x) => x === 'question_answered').length, uniqueAttempts)
ok(`13 events.csv: ${lines.length} rows, one question_answered per attempt, P01, build ok`)

// 16. heartbeats measure time on app: one per 30 s on screen, none while hidden.
// A separate browser context (own localStorage) with the page clock running 4x, so 30 s takes 7.5 s.
{
  const ctx = await browser.createBrowserContext()
  const hb = await ctx.newPage()
  await hb.evaluateOnNewDocument(() => {
    const realNow = Date.now.bind(Date)
    const start = realNow()
    Date.now = () => start + (realNow() - start) * 4
    let hidden = false
    Object.defineProperty(document, 'visibilityState', { get: () => (hidden ? 'hidden' : 'visible') })
    window.__setHidden = (h) => {
      hidden = h
      document.dispatchEvent(new Event('visibilitychange'))
    }
  })
  const beats = () => hb.evaluate(() => JSON.parse(localStorage.getItem('clipcademy') ?? '{}').event_queue ?? [])
  const sent = []
  await hb.setRequestInterception(true)
  hb.on('request', (req) => {
    if (new URL(req.url()).pathname === '/events' && req.method() === 'POST') sent.push(JSON.parse(req.postData()))
    req.continue()
  })
  await hb.goto(APP, { waitUntil: 'networkidle0' })
  await hb.waitForSelector('#code')
  await hb.type('#code', 'P01')
  await hb.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Continue').click())
  await hb.waitForFunction(() => document.body.innerText.includes('Which topics are on your exam?'), { timeout: 8000 })
  const count = () => sent.filter((e) => e.event_name === 'heartbeat').length
  await new Promise((r) => setTimeout(r, 8500)) // 34 s of page time on screen
  assert.equal(count(), 1, `one heartbeat after ~34 s visible (got ${count()})`)
  await hb.evaluate(() => window.__setHidden(true))
  await new Promise((r) => setTimeout(r, 9000)) // 36 s hidden
  assert.equal(count(), 1, 'no heartbeats while hidden')
  await hb.evaluate(() => window.__setHidden(false))
  await new Promise((r) => setTimeout(r, 7000)) // 28 s more on screen: 34 + 28 = 62 s visible in total
  assert.equal(count(), 2, `second heartbeat once visible time passes 60 s (got ${count()})`)
  const beat = sent.find((e) => e.event_name === 'heartbeat')
  assert.equal(beat.participant_id, 'P01')
  assert.ok(beat.event_id && beat.client_timestamp_utc && beat.build_id, 'heartbeat carries the standard fields')
  assert.deepEqual((await beats()).filter((e) => e.event_name === 'heartbeat'), [], 'heartbeats were sent, not left queued')
  await ctx.close()
  ok('16 heartbeats: one per 30 s on screen, paused while hidden')
}

assert.deepEqual(errors, [])
ok('no page errors')
await browser.close()
