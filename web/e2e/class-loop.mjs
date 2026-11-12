// US-42 and US-43 in headless Chrome: a course class runs the MVP's wrong-answer loop and survives a refresh.
// The class API is mocked here, so only the page is under test. Run:
//   npm run dev        (in web/)
//   node e2e/class-loop.mjs
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'

const APP = (process.env.APP ?? 'http://127.0.0.1:5173/').replace(/\/$/, '')
const CHROME =
  process.env.CHROME ??
  { win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe', darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }[process.platform] ??
  '/usr/bin/google-chrome'

const clip = (variant_id, title) => ({ clip_id: variant_id, variant_id, title, video_url: `/e2e/clip.mp4#${variant_id}`,
  captions_url: '/e2e/none.vtt', transcript: `${title} transcript` })
const question = (question_id, prompt) => ({ question_id, objective_id: 'osmosis', prompt,
  choices: [{ choice_id: 'A', text: 'Only water' }, { choice_id: 'B', text: 'Only solutes' }] })
const COURSE = {
  title: 'Biology 101', join_code: 'ABC234',
  objectives: [{
    objective_id: 'osmosis', topic_id: 'cells', label: 'Osmosis',
    clips: [clip('intro_1', 'What moves in osmosis?')],
    followups: { solutes_move_followup: clip('solutes_move_followup', 'Only water crosses'),
      solutes_move_followup_2: clip('solutes_move_followup_2', 'Think of a sieve') },
    questions: [question('q1', 'What crosses the membrane in osmosis?')],
    retries: { r1: question('r1', 'Salt water meets fresh water. What moves?'),
      r2: question('r2', 'A raisin swells in water. What went in?') },
  }],
}

// The server's grading for this course, cut down to the path the test walks.
function grade({ question_id, selected_choice_id, remediation_state }) {
  const state = { objective_status: 'in_progress', remediation_count: 0, satisfied_question_ids: [], asked_retry_ids: [], ...remediation_state }
  const right = selected_choice_id === 'A'
  const base = { correct: right, feedback: right ? 'Correct. Only water moves.' : 'The membrane blocks solutes; water moves.',
    next_video_request: null, next_question_id: null, review_points: null }
  if (right) return { ...base, action: 'complete', remediation_state: { ...state, objective_status: 'complete', expected_question_id: null } }
  if (question_id === 'r1') {
    return { ...base, action: 'needs_review', review_points: ['Only water crosses the membrane.'],
      remediation_state: { ...state, objective_status: 'needs_review', expected_question_id: null } }
  }
  return { ...base, action: 'review_again', misconception_id: 'solutes_move', next_question_id: 'r1',
    next_video_request: { variant_id: 'solutes_move_followup' },
    remediation_state: { ...state, remediation_count: 1, asked_retry_ids: ['r1'], expected_question_id: 'r1' } }
}

const browser = await puppeteer.launch({ executablePath: CHROME })
const page = await browser.newPage()
page.on('pageerror', (err) => { throw err })
await page.setRequestInterception(true)
const attempts = []
page.on('request', (req) => {
  const path = new URL(req.url()).pathname
  const json = (body) => req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  if (path === '/courses/ABC234' && req.method() === 'GET') return json(COURSE)
  if (path === '/courses/ABC234/attempts' && req.method() === 'POST') {
    const body = JSON.parse(req.postData())
    attempts.push(body)
    return json(grade(body))
  }
  req.continue()
})

const text = () => page.evaluate(() => document.body.innerText)
const waitText = (s) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 8000 }, s).catch(async (e) => { throw new Error(`waiting for "${s}" but the page says: ${await text()}`) })
const click = (label) => page.evaluate((l) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().startsWith(l))
  if (!b) throw new Error(`no button "${l}" in: ${document.body.innerText}`)
  b.click()
}, label)
const answer = async (letter) => {
  await page.evaluate((l) => [...document.querySelectorAll('.choice-button')].find((b) => b.innerText.trim().startsWith(l)).click(), letter)
  await click('Check answer')
}
const videoSrc = () => page.evaluate(() => document.querySelector('video')?.getAttribute('src') ?? '')

await page.goto(`${APP}/class.html#ABC234`, { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })
await waitText('Osmosis')
await click('Osmosis')
await waitText('clip 1 of 1')
await click('Answer the question')
await waitText('What crosses the membrane in osmosis?')

// Wrong: feedback, then the follow-up clip for that mistake (US-42).
await answer('B')
await waitText('The membrane blocks solutes; water moves.')
assert.equal(attempts[0].question_id, 'q1')
assert.ok(attempts[0].attempt_id, 'attempt_id is sent')
await click('Watch explanation')
await waitText('Only water crosses')
assert.match(await videoSrc(), /solutes_move_followup$/)

// A refresh keeps the place (US-43).
await page.reload({ waitUntil: 'networkidle0' })
await waitText('Only water crosses')
assert.match(await videoSrc(), /solutes_move_followup$/)

// Then a fresh retry, sent with the saved remediation state.
await click('Now a new question')
await waitText('Salt water meets fresh water. What moves?')
await answer('B')
await waitText('The membrane blocks solutes; water moves.')
assert.equal(attempts[1].question_id, 'r1')
assert.equal(attempts[1].remediation_state.remediation_count, 1)
await click('See summary')
await waitText('Go over these')
assert.ok((await text()).includes('Only water crosses the membrane.'))

// Home shows the result and offers Restart (US-43).
await click('Return home')
await waitText('Needs review')
await click('Osmosis')
await waitText('Restart')
await click('Restart')
await waitText('clip 1 of 1')

await browser.close()
console.log('class-loop: all checks passed')
