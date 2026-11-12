// Students (US-34): join with a class code, watch a topic's approved clips, then answer its questions.
import '../style.css'
import './platform.css'
import { api, h, mount, remember } from './dom.js'

const app = document.getElementById('app')
const KEY = 'clipcademy-class-code'
let course = null

const codeFromHash = () => (location.hash.match(/^#\/?([A-Za-z0-9]{6})\b/) ?? [])[1]

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
    homeScreen()
  } catch (err) {
    codeScreen(err.status === 404 ? `No class has the code ${code}. Check it with your teacher.` : `Couldn't load the class. ${err.message}`)
  }
}

function homeScreen() {
  const list = course.objectives
  mount(app,
    h('p', { class: 'eyebrow' }, `Class ${course.join_code}`),
    h('h1', {}, course.title),
    list.length
      ? [h('p', { class: 'lede' }, 'Pick a topic. Watch the short clips, then answer from memory.'),
        h('ul', { class: 'cards' }, list.map((obj, i) =>
          h('li', {}, h('button', { type: 'button', class: 'card-button', onclick: () => clipScreen(i, 0) },
            h('span', { class: 'row-title' }, obj.label),
            h('span', { class: 'row-sub' }, `${obj.clips.length} clip${obj.clips.length === 1 ? '' : 's'} · ${obj.questions.length} question${obj.questions.length === 1 ? '' : 's'}`)))))]
      : h('p', { class: 'lede' }, 'Your teacher hasn’t published any clips yet. Check back soon.'),
    h('p', {}, h('button', { type: 'button', class: 'link', onclick: () => { remember.set(KEY, null); location.hash = ''; codeScreen() } }, 'Use a different code')))
}

function clipScreen(oi, ci) {
  const obj = course.objectives[oi]
  const clip = obj.clips[ci]
  const last = ci === obj.clips.length - 1
  const next = () => (last ? questionScreen(oi, 0, 0) : clipScreen(oi, ci + 1))
  const video = h('video', { class: 'clip-video', src: clip.video_url, controls: true, playsinline: true, preload: 'auto', autoplay: true },
    h('track', { kind: 'captions', src: clip.captions_url, srclang: 'en', label: 'English' }))
  video.addEventListener('ended', () => nextButton.focus())
  const nextButton = h('button', { type: 'button', class: 'primary', onclick: next },
    last ? (obj.questions.length ? 'Answer the questions' : 'Done') : 'Next clip')
  mount(app,
    h('button', { type: 'button', class: 'link back-link', onclick: homeScreen }, '← Topics'),
    h('p', { class: 'eyebrow' }, `${obj.label} · clip ${ci + 1} of ${obj.clips.length}`),
    h('div', { class: 'clip-frame' }, video),
    h('details', { class: 'transcript' }, h('summary', {}, 'Transcript'), h('p', {}, clip.transcript)),
    h('div', { class: 'bar' }, nextButton))
}

function questionScreen(oi, qi, score) {
  const obj = course.objectives[oi]
  if (qi >= obj.questions.length) return summaryScreen(oi, score)
  const q = obj.questions[qi]
  let picked = null
  const submit = h('button', { type: 'button', class: 'primary', disabled: true }, 'Check answer')
  const choices = q.choices.map((c) => h('button', {
    type: 'button', class: 'choice-button', 'aria-pressed': 'false',
    onclick: (e) => {
      picked = c.choice_id
      choices.forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)))
      submit.disabled = false
    },
  }, h('span', { class: 'letter' }, c.choice_id), h('span', {}, c.text)))
  submit.addEventListener('click', async () => {
    submit.disabled = true
    choices.forEach((b) => (b.disabled = true))
    try {
      const result = await api('POST', `/courses/${course.join_code}/answers`, { body: { question_id: q.question_id, choice_id: picked } })
      choices.forEach((b, i) => {
        const id = q.choices[i].choice_id
        if (id === result.correct_choice_id) b.classList.add('is-right')
        else if (id === picked) b.classList.add('is-wrong')
      })
      const nextScore = score + (result.correct ? 1 : 0)
      feedback.replaceChildren(
        h('p', { class: result.correct ? 'verdict ok' : 'verdict no' }, result.correct ? 'Right.' : 'Not quite.'),
        h('p', {}, result.feedback))
      bar.replaceChildren(h('button', { type: 'button', class: 'primary', onclick: () => questionScreen(oi, qi + 1, nextScore) },
        qi + 1 < obj.questions.length ? 'Next question' : 'See how you did'))
    } catch (err) {
      feedback.replaceChildren(h('p', { class: 'error-text', role: 'alert' }, `Couldn't check your answer. ${err.message}`))
      submit.disabled = false
      choices.forEach((b) => (b.disabled = false))
    }
  })
  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' })
  const bar = h('div', { class: 'bar' }, submit)
  mount(app,
    h('button', { type: 'button', class: 'link back-link', onclick: homeScreen }, '← Topics'),
    h('p', { class: 'eyebrow' }, `${obj.label} · question ${qi + 1} of ${obj.questions.length}`),
    h('h1', { class: 'prompt' }, q.prompt),
    h('div', { class: 'choices', role: 'group', 'aria-label': 'Choices' }, choices),
    feedback, bar)
}

function summaryScreen(oi, score) {
  const obj = course.objectives[oi]
  const total = obj.questions.length
  mount(app,
    h('p', { class: 'eyebrow' }, obj.label),
    h('h1', {}, total ? `${score} of ${total} right` : 'Topic finished'),
    h('p', { class: 'lede' }, total && score < total ? 'Rewatch the clips for the ones you missed, then try again.' : 'Nice work. Pick another topic when you’re ready.'),
    h('div', { class: 'bar' },
      h('button', { type: 'button', class: 'secondary', onclick: () => clipScreen(oi, 0) }, 'Watch again'),
      h('button', { type: 'button', class: 'primary', onclick: homeScreen }, 'Topics')))
}

function route() {
  const code = codeFromHash()
  if (code) return load(code.toUpperCase())
  const saved = remember.get(KEY)
  if (saved) return load(saved)
  codeScreen()
}

addEventListener('hashchange', route)
route()
