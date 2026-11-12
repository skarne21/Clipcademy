// Students (US-34, US-42, US-43): join with a class code, watch a topic's clips, then answer from memory. A wrong
// answer plays the follow-up clip for that mistake and then a fresh question, exactly as in the biology app; the
// server grades with the MVP's rules. Each topic's place is saved in this browser per class code.
import '../style.css'
import './platform.css'
import { api, h, mount, remember } from './dom.js'

const app = document.getElementById('app')
const KEY = 'clipcademy-class-code'
let course = null
let saved = {} // objective_id -> { step, clip, remediation_state, last_result }

const codeFromHash = () => (location.hash.match(/^#\/?([A-Za-z0-9]{6})\b/) ?? [])[1]
const progressKey = () => `clipcademy-class-progress-${course.join_code}`
const openKey = () => `clipcademy-class-open-${course.join_code}`
const save = () => remember.set(progressKey(), JSON.stringify(saved))
const fresh = () => ({ step: 'clips', clip: 0, remediation_state: {}, last_result: null })
const progress = (obj) => (saved[obj.objective_id] ??= fresh())
const status = (obj) => {
  const p = saved[obj.objective_id]
  return p?.remediation_state?.objective_status ?? (p && (p.step !== 'clips' || p.clip > 0) ? 'in_progress' : null)
}
const STATUS_TEXT = { in_progress: 'In progress', complete: 'Complete', needs_review: 'Needs review' }

function codeScreen(message) {
  let input
  const join = async (e) => {
    e.preventDefault()
    const code = input.value.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(code)) return codeScreen('Class codes are 6 letters and numbers.')
    location.hash = code
  }
  mount(app,
    h('h1', {}, 'Join your class'),
    h('p', { class: 'lede' }, 'Enter the 6-character code your teacher gave you.'),
    h('form', { class: 'stack', onsubmit: join },
      h('label', { for: 'code', class: 'field-label' }, 'Class code'),
      (input = h('input', { id: 'code', class: 'field code-input', autocomplete: 'off', autocapitalize: 'characters',
        maxlength: '6', value: remember.get(KEY) ?? '', 'aria-describedby': message ? 'code-error' : null })),
      message && h('p', { id: 'code-error', class: 'error-text', role: 'alert' }, message),
      h('button', { type: 'submit', class: 'primary' }, 'Join')))
  input.focus()
}

async function load(code) {
  mount(app, h('p', { class: 'note' }, 'Loading your class…'))
  try {
    course = await api('GET', `/courses/${code}`)
    remember.set(KEY, course.join_code)
    try { saved = JSON.parse(remember.get(progressKey()) ?? '{}') ?? {} } catch { saved = {} }
    const reopen = course.objectives.findIndex((o) => o.objective_id === remember.get(openKey()))
    reopen >= 0 ? open(reopen) : homeScreen()
  } catch (err) {
    codeScreen(err.status === 404 ? `No class has the code ${code}. Check it with your teacher.` : `Couldn't load the class. ${err.message}`)
  }
}

function homeScreen() {
  remember.set(openKey(), null)
  const list = course.objectives
  mount(app,
    h('p', { class: 'eyebrow' }, `Class ${course.join_code}`),
    h('h1', {}, course.title),
    list.length
      ? [h('p', { class: 'lede' }, 'Pick a topic. Watch the short clips, then answer from memory.'),
        h('ul', { class: 'cards' }, list.map((obj, i) =>
          h('li', {}, h('button', { type: 'button', class: 'card-button', onclick: () => open(i) },
            h('span', { class: 'row-title' }, obj.label),
            h('span', { class: 'row-sub' }, STATUS_TEXT[status(obj)] ??
              `${obj.clips.length} clip${obj.clips.length === 1 ? '' : 's'} · ${obj.questions.length} question${obj.questions.length === 1 ? '' : 's'}`)))))]
      : h('p', { class: 'lede' }, 'Your teacher hasn’t made any clips yet. Check back soon.'),
    h('p', {}, h('button', { type: 'button', class: 'link', onclick: () => { remember.set(KEY, null); location.hash = ''; codeScreen() } }, 'Use a different code')))
}

// Resume a topic at its saved step (US-43).
function open(oi) {
  const obj = course.objectives[oi]
  const p = progress(obj)
  remember.set(openKey(), obj.objective_id) // a refresh reopens this topic
  const screens = { clips: () => clipScreen(oi), question: () => questionScreen(oi), feedback: () => feedbackScreen(oi),
    followup: () => followupScreen(oi), summary: () => summaryScreen(oi) }
  ;(screens[p.step] ?? screens.clips)()
}

function setStep(oi, changes) {
  Object.assign(progress(course.objectives[oi]), changes)
  save()
  open(oi)
}

function restart(oi) {
  saved[course.objectives[oi].objective_id] = fresh()
  save()
  open(oi)
}

const back = () => h('button', { type: 'button', class: 'link back-link', onclick: homeScreen }, '← Topics')

function player(clip, eyebrow, nextLabel, next) {
  const video = h('video', { class: 'clip-video', src: clip.video_url, controls: true, playsinline: true, preload: 'auto', autoplay: true },
    h('track', { kind: 'captions', src: clip.captions_url, srclang: 'en', label: 'English' }))
  const nextButton = h('button', { type: 'button', class: 'primary', onclick: next }, nextLabel)
  video.addEventListener('ended', () => nextButton.focus())
  mount(app,
    back(),
    h('p', { class: 'eyebrow' }, eyebrow),
    h('h1', { class: 'prompt' }, clip.title),
    h('div', { class: 'clip-frame' }, video),
    h('details', { class: 'transcript' }, h('summary', {}, 'Transcript'), h('p', {}, clip.transcript)),
    h('div', { class: 'bar' }, nextButton))
}

function clipScreen(oi) {
  const obj = course.objectives[oi]
  const p = progress(obj)
  const ci = Math.min(p.clip, obj.clips.length - 1)
  const last = ci === obj.clips.length - 1
  const done = obj.questions.length ? () => setStep(oi, { step: 'question' }) : homeScreen
  player(obj.clips[ci], `${obj.label} · clip ${ci + 1} of ${obj.clips.length}`,
    last ? (obj.questions.length ? 'Answer the question' : 'Done') : 'Next clip',
    last ? done : () => setStep(oi, { clip: ci + 1 }))
}

function questionScreen(oi) {
  const obj = course.objectives[oi]
  const p = progress(obj)
  const qid = p.remediation_state.expected_question_id ?? obj.questions[0]?.question_id
  const q = obj.questions.find((x) => x.question_id === qid) ?? obj.retries?.[qid]
  if (!q) return restart(oi) // the teacher deleted it since; start the topic again
  let picked = null
  const submit = h('button', { type: 'button', class: 'primary', disabled: true }, 'Check answer')
  const error = h('div', { 'aria-live': 'polite' })
  const choices = q.choices.map((c) => h('button', {
    type: 'button', class: 'choice-button', 'aria-pressed': 'false',
    onclick: (e) => {
      picked = c.choice_id
      choices.forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)))
      submit.disabled = false
    },
  }, h('span', { class: 'letter' }, c.choice_id), h('span', {}, c.text)))
  // One attempt ID per submission, so a re-sent request (flaky network) is graded once.
  const attemptId = crypto.randomUUID()
  submit.addEventListener('click', async () => {
    submit.disabled = true
    choices.forEach((b) => (b.disabled = true))
    try {
      const result = await api('POST', `/courses/${course.join_code}/attempts`, { body: {
        attempt_id: attemptId, objective_id: obj.objective_id, question_id: q.question_id,
        selected_choice_id: picked, remediation_state: p.remediation_state } })
      setStep(oi, { step: 'feedback', remediation_state: result.remediation_state,
        last_result: { ...result, answer: `${picked}. ${q.choices.find((c) => c.choice_id === picked).text}` } })
    } catch (err) {
      error.replaceChildren(h('p', { class: 'error-text', role: 'alert' }, `Couldn't check your answer. ${err.message}`))
      submit.disabled = false
      choices.forEach((b) => (b.disabled = false))
    }
  })
  mount(app,
    back(),
    h('p', { class: 'eyebrow' }, obj.questions.some((x) => x.question_id === qid) ? obj.label : `${obj.label} · new question`),
    h('h1', { class: 'prompt' }, q.prompt),
    h('div', { class: 'choices', role: 'group', 'aria-label': 'Choices' }, choices),
    error, h('div', { class: 'bar' }, submit))
}

function feedbackScreen(oi) {
  const r = progress(course.objectives[oi]).last_result
  const [label, next] = {
    continue_questions: ['Next question', () => setStep(oi, { step: 'question' })],
    review_again: ['Watch explanation', () => setStep(oi, { step: 'followup' })],
    complete: ['See summary', () => setStep(oi, { step: 'summary' })],
    needs_review: ['See summary', () => setStep(oi, { step: 'summary' })],
  }[r.action]
  mount(app,
    back(),
    h('h1', { class: r.correct ? 'verdict ok' : 'verdict no' }, r.correct ? 'Correct' : 'Not quite'),
    h('p', { class: 'note' }, `Your answer: ${r.answer}`),
    h('p', {}, r.feedback),
    h('div', { class: 'bar' }, h('button', { type: 'button', class: 'primary', onclick: next }, label)))
}

function followupScreen(oi) {
  const obj = course.objectives[oi]
  const variant = progress(obj).last_result.next_video_request?.variant_id
  const clip = obj.followups?.[variant]
  // A follow-up the teacher deleted (or that failed to render) is skipped; the new question still follows (US-42).
  if (!clip) return setStep(oi, { step: 'question' })
  player(clip, `${obj.label} · explanation`, 'Now a new question', () => setStep(oi, { step: 'question' }))
}

function summaryScreen(oi) {
  const obj = course.objectives[oi]
  const p = progress(obj)
  const r = p.last_result
  const complete = p.remediation_state.objective_status === 'complete'
  mount(app,
    back(),
    h('p', { class: 'eyebrow' }, obj.label),
    complete
      ? h('h1', {}, 'Complete')
      : [h('h1', {}, 'Needs review'),
        h('p', { class: 'lede' }, 'That happens: go over these points, then try it again when you’re ready.'),
        r?.feedback && h('p', {}, r.feedback),
        r?.review_points?.length && [h('h2', {}, 'Go over these'), h('ul', { class: 'points' }, r.review_points.map((x) => h('li', {}, x)))]],
    h('div', { class: 'bar' },
      h('button', { type: 'button', class: 'secondary', onclick: () => restart(oi) }, 'Restart'),
      h('button', { type: 'button', class: 'primary', onclick: homeScreen }, 'Return home')))
}

function route() {
  const code = codeFromHash()
  if (code) return load(code.toUpperCase())
  const savedCode = remember.get(KEY)
  if (savedCode) return load(savedCode)
  codeScreen()
}

addEventListener('hashchange', route)
route()
