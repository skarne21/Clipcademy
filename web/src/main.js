import './style.css'
import { getTopics, getQuestion, submitAttempt, startVideo, getVideo } from './api.js'
import { state, save, newObjective, resetDemo } from './store.js'
import { track, flush } from './events.js'

const app = document.getElementById('app')

// Bumped on every screen change. Async work started for an older screen checks it and stops,
// so a slow clip or answer for one objective never draws over another.
let nav = 0
const stale = (n) => n !== nav

// ---------- DOM helpers ----------

const nodes = (children) => children.flat(Infinity).filter((c) => c != null && c !== false && c !== 0)

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else el.setAttribute(k, v === true ? '' : v)
  }
  el.append(...nodes(children))
  return el
}

function show(...children) {
  app.replaceChildren(...nodes(children))
  window.scrollTo(0, 0)
}

const go = (hash) => (location.hash === hash ? route() : (location.hash = hash))
const back = () => h('a', { href: '#/home', class: 'back' }, 'Back')
const bar = (...buttons) => h('div', { class: 'bar' }, ...buttons)
const primary = (label, onclick) => h('button', { type: 'button', class: 'primary', onclick }, label)
const secondary = (label, onclick) => h('button', { type: 'button', class: 'secondary', onclick }, label)
const skeleton = () => h('div', { class: 'skeleton', 'aria-label': 'Loading' }, h('div'), h('div'), h('div'))

function errorBlock(message, retry) {
  return h('div', { class: 'error-block', role: 'alert' }, h('p', {}, message), secondary('Try again', retry))
}

const ICONS = {
  ok: 'M5 12.5l4.5 4.5L19 7.5',
  no: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = `<path d="${ICONS[name]}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
  return svg
}

// "L19-p1" -> "Lecture 19, p. 1"
const sourceLabel = (refs = []) =>
  refs.map((r) => r.replace(/^L(\d+)-p(\d+)$/, 'Lecture $1, p. $2')).join('; ')

// ---------- topics ----------

let topicsPromise
function loadTopics() {
  topicsPromise ??= getTopics()
    .then((d) => d.topics)
    .catch((err) => {
      topicsPromise = null
      throw err
    })
  return topicsPromise
}

function findObjective(topics, id) {
  for (const topic of topics)
    for (const objective of topic.objectives) if (objective.objective_id === id) return { topic, objective }
}

// ---------- routing ----------

// The server decides the next question; it's always the saved expected_question_id.
const questionId = ({ o, objective }) => o.remediation_state.expected_question_id ?? objective.required_question_ids[0]

function routeFor(ctx) {
  const { o, id } = ctx
  if (o.step === 'question') return `#/question/${questionId(ctx)}`
  if (o.step === 'feedback' || o.step === 'followup') return `#/${o.step}`
  return `#/${o.step}/${id}`
}

function setStep(ctx, step) {
  ctx.o.step = step
  ctx.o.video_jobs = {}
  ctx.o.clip_index = 0
  save()
  go(routeFor(ctx))
}

async function route() {
  const n = ++nav
  flush() // every screen change retries unsent events
  const [, name = '', arg = '']= location.hash.match(/^#\/([^/]*)\/?(.*)$/) ?? []
  if (!state.participant_id || name === 'code') return codeScreen()

  show(skeleton())
  let topics
  try {
    topics = await loadTopics()
  } catch (err) {
    if (!stale(n)) show(errorBlock(`Couldn't load your topics. ${err.message}`, route))
    return
  }
  if (stale(n)) return

  if (name === 'topics') return topicsScreen(topics)
  if (['lesson', 'question', 'feedback', 'followup', 'summary'].includes(name)) {
    const id = name === 'lesson' || name === 'summary' ? decodeURIComponent(arg) : state.current_objective_id
    const found = id && findObjective(topics, id)
    const o = found && state.objectives[id]
    if (!o || found.topic.availability !== 'available') return location.replace('#/home')
    const ctx = { id, o, ...found }
    state.current_objective_id = id
    save()
    // The saved step is the truth: a stale link or the Back button can't reopen an answered question.
    const want = routeFor(ctx)
    if (location.hash !== want) return location.replace(want)
    if (o.step === 'lesson') return feedScreen(n, ctx, ctx.objective.intro_video_requests, false)
    if (o.step === 'question') return questionScreen(n, ctx)
    if (o.step === 'feedback') return feedbackScreen(ctx)
    if (o.step === 'followup') return feedScreen(n, ctx, [o.last_result.next_video_request], true)
    return summaryScreen(ctx)
  }
  if (name !== 'home' && !state.selected_topic_ids.length) return location.replace('#/topics')
  return homeScreen(topics)
}

// ---------- screens ----------

function codeScreen() {
  const input = h('input', {
    id: 'code',
    placeholder: 'P01',
    autocapitalize: 'characters',
    autocomplete: 'off',
    spellcheck: 'false',
    value: state.participant_id ?? '',
  })
  const error = h('p', { id: 'code-error', class: 'field-error', hidden: true })
  const onsubmit = (e) => {
    e.preventDefault()
    const code = input.value.trim().toUpperCase()
    if (!code) {
      error.textContent = 'Enter the participant code you were given.'
      error.hidden = false
      input.setAttribute('aria-invalid', 'true')
      input.setAttribute('aria-describedby', 'code-error')
      return input.focus()
    }
    state.participant_id = code
    save()
    flush() // sends the app_opened queued before the code existed
    go(state.selected_topic_ids.length ? '#/home' : '#/topics')
  }
  show(
    h(
      'form',
      { onsubmit, novalidate: true },
      h('h1', {}, 'Clipcademy'),
      h('p', { class: 'lede' }, 'Short biology review clips, each followed by a question.'),
      h('label', { for: 'code' }, 'Participant code'),
      input,
      error,
      bar(h('button', { type: 'submit', class: 'primary' }, 'Continue')),
    ),
  )
}

function topicsScreen(topics) {
  const rows = topics.map((t) => {
    const soon = t.availability !== 'available'
    const box = h('input', {
      type: 'checkbox',
      checked: state.selected_topic_ids.includes(t.topic_id),
      onchange: () => {
        const picked = new Set(state.selected_topic_ids)
        box.checked ? picked.add(t.topic_id) : picked.delete(t.topic_id)
        state.selected_topic_ids = topics.map((x) => x.topic_id).filter((id) => picked.has(id))
        save()
      },
    })
    return h(
      'li',
      {},
      h(
        'label',
        { class: soon ? 'row quiet' : 'row' },
        box,
        h('span', {}, h('span', { class: 'row-title' }, t.label), h('span', { class: 'row-sub' }, soon ? 'Coming soon' : 'Ready to review')),
      ),
    )
  })
  show(
    h('h1', {}, 'Which topics are on your exam?'),
    h('p', { class: 'lede' }, 'Pick every topic you want to review. You can change this later.'),
    h('ul', { class: 'list' }, rows),
    bar(primary('Continue', () => go('#/home'))),
  )
}

const STEP_TEXT = {
  lesson: 'In progress: watching the lesson',
  question: 'In progress: answering a question',
  feedback: 'In progress: answering a question',
  followup: 'In progress: watching an explanation',
}

function objectiveRow(topic, objective) {
  const id = objective.objective_id
  const o = state.objectives[id]
  const status = o?.remediation_state.objective_status
  const open = () => {
    state.current_objective_id = id
    save()
    go(routeFor({ id, o: state.objectives[id], objective }))
  }
  let text, action
  if (!o) {
    text = 'Not started'
    action = primary('Start', () => {
      state.objectives[id] = newObjective(topic.topic_id)
      track('topic_selected', { topic_id: topic.topic_id, objective_id: id })
      open()
    })
  } else if (status === 'complete' || status === 'needs_review') {
    // Restart sits on the row because the moderator's scripted task begins with "Tap Restart".
    text = [status === 'complete' ? 'Complete' : 'Needs review', ' · ', h('button', { type: 'button', class: 'link', onclick: open }, 'See summary')]
    action = secondary('Restart', () => restart({ id, topic }))
  } else {
    text = STEP_TEXT[o.step] ?? 'In progress'
    action = primary('Resume', open)
  }
  return h('li', { class: 'objective' }, h('div', {}, h('p', { class: 'row-title' }, objective.label), h('p', { class: 'row-sub' }, text)), action)
}

function homeScreen(topics) {
  const chosen = topics.filter((t) => state.selected_topic_ids.includes(t.topic_id))
  const sections = chosen.map((t) =>
    h(
      'section',
      {},
      h('h2', {}, t.label),
      t.availability === 'available'
        ? h('ul', { class: 'list' }, t.objectives.map((obj) => objectiveRow(t, obj)))
        : h('p', { class: 'row-sub' }, "Coming soon. This topic's lessons aren't ready yet."),
    ),
  )
  const reset = h('button', { type: 'button', class: 'link' }, 'Reset demo')
  reset.addEventListener('click', () => {
    if (!reset.dataset.armed) {
      reset.dataset.armed = '1'
      reset.textContent = 'Tap again to clear all progress'
      return
    }
    resetDemo()
    track('demo_reset')
    go('#/topics')
  })
  show(
    h('h1', {}, 'Your review'),
    chosen.length ? sections : h('p', { class: 'lede' }, "You haven't picked any exam topics yet."),
    h('footer', {}, chosen.length && h('a', { href: '#/topics' }, 'Change exam topics'), reset, h('a', { href: '#/code', class: 'participant' }, state.participant_id)),
    !chosen.length && bar(primary('Pick topics', () => go('#/topics'))),
  )
}

// ---------- clip feed ----------
// Full-screen 9:16 clips, swiped up and down like a short-video feed (notes.md). Native scroll
// snapping does the swiping; an IntersectionObserver says which slide is on screen. When a clip
// finishes, the feed scrolls to the next one by itself; the student can still swipe either way at
// any time. Reaching the slide after the last clip (by swiping or by itself) opens the question.

let soundOn = false // one tap turns the sound on for the rest of the feed

const SVG = {
  replay: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5',
  captions: 'M3 6h18v12H3zM7 11h4M7 14h3M13 11h4M13 14h3',
  transcript: 'M6 4h12v16H6zM9 8h6M9 11h6M9 14h4',
  muted: 'M4 10v4h4l5 4V6L8 10zM16 10l4 4M20 10l-4 4',
  up: 'M6 15l6-6 6 6',
}
function glyph(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = `<path d="${SVG[name]}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
  return svg
}
const sideButton = (name, label, onclick) => h('button', { type: 'button', class: 'side', onclick }, glyph(name), h('span', {}, label))

const disclosure = (job) =>
  job.review_status === 'preview'
    ? 'Team review copy: content approval pending. Synthetic narration.'
    : job.source === 'generated'
      ? 'Rendered just now from a fixed reviewed script. Synthetic narration.'
      : 'Previously rendered from a fixed reviewed script. Synthetic narration.'

function feedScreen(n, ctx, requests, followup) {
  const { o } = ctx
  o.video_jobs ??= {}
  const total = requests.length
  const ids = { topic_id: o.topic_id, objective_id: ctx.id }

  const slides = requests.map((request, i) =>
    h('section', { class: 'slide', 'aria-label': followup ? 'Explanation' : `Clip ${i + 1} of ${total}` }, h('div', { class: 'frame' })),
  )
  const end = h(
    'section',
    { class: 'slide', 'aria-label': 'Question' },
    h('div', { class: 'frame end' }, h('p', {}, followup ? 'Now a new question' : "Let's see what you remember")),
  )
  const scroller = h('div', { class: 'feed-scroll', tabindex: '0', 'aria-label': 'Clips. Swipe up for the next one.' }, slides, end)

  const fills = requests.map(() => h('span', { class: 'fill' }))
  const count = h('span', { class: 'count' })
  const note = h('p', { class: 'disclosure' })
  const hint = h('p', { class: 'swipe-hint', hidden: true }, glyph('up'), 'Swipe up')
  const soundPill = h('button', { type: 'button', class: 'sound-pill', onclick: () => unmute() }, glyph('muted'), 'Tap for sound')
  const ccButton = sideButton('captions', 'Captions', () => {
    state.captions_on = !state.captions_on
    save()
    applyCaptions()
  })
  const transcriptText = h('p', {})
  const sheet = h(
    'dialog',
    { class: 'sheet', 'aria-label': 'Transcript' },
    h('h2', {}, 'Transcript'),
    transcriptText,
    h('form', { method: 'dialog' }, h('button', { class: 'secondary' }, 'Close')),
  )
  const hud = h(
    'div',
    { class: 'hud frame' },
    h(
      'div',
      { class: 'hud-top' },
      h('div', { class: 'segments' }, fills.map((f) => h('span', { class: 'segment' }, f))),
      h('div', { class: 'hud-row' }, h('a', { href: '#/home', class: 'back' }, 'Back'), count),
      soundPill,
    ),
    h(
      'div',
      { class: 'hud-side' },
      sideButton('replay', 'Replay', () => {
        const v = current()?.video
        if (v) {
          v.currentTime = 0
          play(v)
        }
      }),
      ccButton,
      sideButton('transcript', 'Transcript', () => {
        transcriptText.textContent = current()?.job?.transcript || 'No transcript for this clip yet.'
        current()?.video?.pause()
        sheet.showModal()
      }),
    ),
    h('div', { class: 'hud-bottom' }, hint, note, primary('Answer the question', () => setStep(ctx, 'question'))),
  )
  sheet.addEventListener('close', () => {
    const v = current()?.video
    if (v && !stale(n)) play(v)
  })
  show(h('div', { class: 'feed' }, scroller, hud, sheet))

  const slots = requests.map(() => ({})) // per slide: { job, video, loading }
  let active = null
  let view = null // this viewing of the active slide: what the study events report
  let autoSwipe = false // the next slide change comes from a clip ending, not from the student
  const current = () => (active == null ? null : slots[active])

  // A clip finished: after a short beat, move to the next slide unless the student already has.
  function advance(i) {
    setTimeout(() => {
      if (stale(n) || active !== i || sheet.open) return
      autoSwipe = true
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
      scroller.scrollTo({ top: scroller.children[i + 1].offsetTop, behavior: reduce ? 'auto' : 'smooth' })
    }, 600)
  }

  function play(v) {
    v.muted = !soundOn
    soundPill.hidden = soundOn
    v.play().catch(() => {
      if (v.muted) return // no autoplay at all here; a tap on the clip starts it
      soundOn = false // sound was refused without a tap: play muted and offer the button
      soundPill.hidden = false
      v.muted = true
      v.play().catch(() => {})
    })
  }

  function unmute() {
    soundOn = true
    const v = current()?.video
    if (v) play(v)
    soundPill.hidden = true
  }

  function applyCaptions() {
    ccButton.setAttribute('aria-pressed', String(!!state.captions_on))
    for (const slot of slots) {
      const t = slot.video?.textTracks[0]
      if (t) t.mode = state.captions_on ? 'showing' : 'hidden'
    }
  }

  function setProgress(i, fraction) {
    fills.forEach((f, j) => (f.style.transform = `scaleX(${j < i ? 1 : j > i ? 0 : fraction})`))
  }

  async function load(i, retry = false) {
    const slot = slots[i]
    if (!slot || slot.loading || (slot.job && !retry)) return
    const request = requests[i]
    const frame = slides[i].firstChild
    Object.assign(slot, { loading: true, job: null, video: null })
    frame.replaceChildren(h('div', { class: 'video-box' }, h('p', {}, 'Preparing your explanation…')))
    let job
    try {
      // After a refresh, keep polling the saved job instead of starting a new one.
      const saved = !retry && o.video_jobs[request.variant_id]
      job = saved ? await getVideo(saved) : await startVideo(request)
      if (stale(n)) return
      if (job.job_id) {
        o.video_jobs[request.variant_id] = job.job_id
        save()
      }
      while (job.status === 'queued' || job.status === 'running') {
        await new Promise((r) => setTimeout(r, 2000))
        if (stale(n)) return
        job = await getVideo(job.job_id)
      }
    } catch {
      job = { status: 'failed' }
    }
    slot.loading = false
    if (stale(n)) return
    if (job.status !== 'ready') return failed(i)
    slot.job = job

    const v = h('video', {
      src: job.video_url,
      playsinline: true,
      muted: true,
      preload: 'auto', // the next clip buffers before the swipe, so there's no spinner between clips
      onplay: () => {
        if (view?.i !== i || view.started) return
        view.started = true
        track('video_started', { ...ids, variant_id: request.variant_id })
      },
      onended: () => {
        if (view?.i !== i) return
        if (!view.completed) track('video_completed', { ...ids, variant_id: request.variant_id })
        view.completed = true
        view.last = 0
        advance(i) // move on to the next clip by itself
      },
      ontimeupdate: () => {
        if (view?.i !== i) return
        const step = v.currentTime - view.last
        if (step > 0 && step < 1.5) view.seconds += step // seeks and loop restarts aren't watching time
        view.last = v.currentTime
        if (v.duration) setProgress(i, v.currentTime / v.duration)
      },
      onerror: () => failed(i),
      onclick: () => (v.muted ? unmute() : v.paused ? play(v) : v.pause()),
    })
    if (job.captions_url) v.append(h('track', { kind: 'captions', src: job.captions_url, srclang: 'en', label: 'English' }))
    slot.video = v
    frame.replaceChildren(v)
    applyCaptions()
    if (i === active) activate(i)
  }

  function failed(i) {
    o.video_jobs[requests[i].variant_id] = null
    save()
    Object.assign(slots[i], { job: null, video: null, loading: false })
    slides[i].firstChild.replaceChildren(
      h(
        'div',
        { class: 'video-box failed', role: 'alert' },
        h('p', {}, "The clip couldn't load.", followup ? ' Your answer is saved.' : ''),
        secondary('Retry', () => load(i, true)),
      ),
    )
    if (i === active) note.textContent = ''
  }

  // A slide came on screen: report the swipe away from the old one, then start the new one.
  function activate(i) {
    if (i !== active) {
      if (active != null) {
        slots[active].video?.pause()
        track('clip_swiped', {
          ...ids,
          variant_id: requests[active].variant_id,
          // 'auto' = the feed moved on after the clip ended, so drop-off counts only real swipes
          direction: autoSwipe && i === active + 1 ? 'auto' : i > active ? 'up' : 'down',
          seconds_watched: Math.round((view?.seconds ?? 0) * 10) / 10,
        })
        hint.hidden = true
      }
      autoSwipe = false
      active = i
      if (i === total) return setStep(ctx, 'question') // swiped past the last clip
      o.clip_index = i
      save()
      view = { i, started: false, completed: false, seconds: 0, last: 0 }
      count.textContent = followup ? 'Explanation' : `Clip ${i + 1} of ${total}`
      hint.hidden = !(i === 0 && !followup && total > 1)
      setProgress(i, 0)
      load(i)
      load(i + 1) // preload the next clip
    }
    const { video, job } = slots[i]
    note.textContent = job ? disclosure(job) : ''
    if (video) {
      video.currentTime = 0
      play(video)
    }
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (stale(n)) return io.disconnect()
      const seen = entries.find((e) => e.isIntersecting)
      if (seen) activate([...scroller.children].indexOf(seen.target))
    },
    { root: scroller, threshold: 0.6 },
  )
  const onVisibility = () => {
    if (stale(n)) return document.removeEventListener('visibilitychange', onVisibility)
    const v = current()?.video
    if (v) document.hidden ? v.pause() : play(v)
  }
  document.addEventListener('visibilitychange', onVisibility)

  // A refresh mid-feed comes back to the same clip.
  scroller.scrollTop = slides[Math.min(o.clip_index ?? 0, total - 1)].offsetTop
  for (const slide of scroller.children) io.observe(slide)
  scroller.focus({ preventScroll: true }) // arrow keys and Page Down move between clips
}

async function questionScreen(n, ctx) {
  const { o } = ctx
  show(back(), skeleton())
  let q
  try {
    q = await getQuestion(questionId(ctx))
  } catch (err) {
    if (!stale(n)) show(back(), errorBlock(`Couldn't load the question. ${err.message}`, () => questionScreen(n, ctx)))
    return
  }
  if (stale(n)) return

  let choice = o.pending_attempt?.selected_choice_id ?? null
  let sending = false
  const submit = h('button', { type: 'submit', class: 'primary', disabled: !choice }, 'Submit')
  const error = h('div', { class: 'error-block', role: 'alert', hidden: true })
  const radios = q.choices.map((c) =>
    h('input', {
      type: 'radio',
      name: 'choice',
      value: c.choice_id,
      checked: c.choice_id === choice,
      onchange: () => {
        choice = c.choice_id
        submit.disabled = false
      },
    }),
  )
  const lock = (locked) => radios.forEach((r) => (r.disabled = locked))

  async function send() {
    sending = true
    lock(true)
    submit.disabled = true
    submit.textContent = 'Checking…'
    error.hidden = true
    const body = o.pending_attempt
    let r
    try {
      r = await submitAttempt(body)
    } catch (err) {
      sending = false
      const rejected = err.status && err.status < 500 // the server won't accept this body, so don't resend it
      if (rejected) {
        o.pending_attempt = null
        save()
      }
      if (stale(n)) return
      submit.disabled = false
      submit.textContent = rejected ? 'Submit' : 'Try again'
      lock(!rejected)
      error.replaceChildren(
        h('p', {}, rejected ? err.message : "Couldn't send your answer. Check your connection and try again."),
        err.status === 409 && secondary('Restart this objective', () => restart(ctx)),
      )
      error.hidden = false
      return
    }
    // Save before showing anything, so a refresh redraws this result instead of resubmitting.
    const picked = q.choices.find((c) => c.choice_id === body.selected_choice_id)
    o.remediation_state = r.remediation_state
    o.last_result = r
    o.attempts.push({ attempt_id: r.attempt_id, question_id: r.question_id, selected_choice_id: picked.choice_id, choice_text: picked.text, correct: r.correct })
    o.pending_attempt = null
    o.step = 'feedback'
    save()
    if (r.correct) navigator.vibrate?.(30) // a small tap of feedback on phones that support it
    const ids = { topic_id: o.topic_id, objective_id: ctx.id }
    track('question_answered', { ...ids, question_id: r.question_id, correct: r.correct })
    if (r.action === 'complete') track('objective_completed', ids)
    if (r.action === 'needs_review') track('objective_needs_review', ids)
    if (!stale(n)) go('#/feedback')
  }

  const onsubmit = (e) => {
    e.preventDefault()
    if (sending || !choice) return
    // A resend keeps the same attempt_id and body, so the server counts it once.
    o.pending_attempt ??= {
      attempt_id: crypto.randomUUID(),
      question_id: q.question_id,
      selected_choice_id: choice,
      objective_id: ctx.id,
      remediation_state: o.remediation_state,
    }
    save()
    send()
  }

  show(
    back(),
    h(
      'form',
      { onsubmit },
      h('h1', { class: 'prompt' }, q.prompt),
      h(
        'fieldset',
        { class: 'choices' },
        h('legend', { class: 'visually-hidden' }, 'Choices'),
        q.choices.map((c, i) => h('label', { class: 'choice' }, radios[i], h('span', { class: 'letter' }, c.choice_id), h('span', {}, c.text))),
      ),
      error,
      bar(submit),
    ),
  )
  if (o.pending_attempt) send() // refreshed while an answer was in flight: resend the same body
}

function feedbackScreen(ctx) {
  const { o } = ctx
  const r = o.last_result
  const last = o.attempts.at(-1)
  const next = {
    continue_questions: ['Next question', () => setStep(ctx, 'question')],
    review_again: [
      'Watch explanation',
      () => {
        track('followup_requested', { topic_id: o.topic_id, objective_id: ctx.id, variant_id: r.next_video_request.variant_id })
        setStep(ctx, 'followup')
      },
    ],
    complete: ['See summary', () => setStep(ctx, 'summary')],
    needs_review: ['See summary', () => setStep(ctx, 'summary')],
  }[r.action]
  show(
    back(),
    h('div', { class: r.correct ? 'result ok' : 'result no' }, icon(r.correct ? 'ok' : 'no'), h('h1', {}, r.correct ? 'Correct' : 'Not quite')),
    h('p', { class: 'your-answer' }, h('span', { class: 'row-sub' }, 'Your answer'), `${last.selected_choice_id}. ${last.choice_text}`),
    h('p', {}, r.feedback),
    r.source_refs?.length && h('p', { class: 'note' }, `Source: ${sourceLabel(r.source_refs)}`),
    bar(primary(...next)),
  )
}

function restart(ctx) {
  state.objectives[ctx.id] = newObjective(ctx.topic.topic_id)
  save()
  go(`#/lesson/${ctx.id}`)
}

function summaryScreen(ctx) {
  const { o } = ctx
  const r = o.last_result
  const complete = o.remediation_state.objective_status === 'complete'
  show(
    back(),
    h('h1', {}, ctx.objective.label),
    complete
      ? h('div', { class: 'result ok' }, icon('ok'), h('p', {}, 'Complete'))
      : [
          h('p', { class: 'lede' }, 'Needs review. That happens: go over these points, then try it again when you’re ready.'),
          r?.feedback && h('p', {}, r.feedback),
          r?.review_points?.length && [h('h2', {}, 'Go over these'), h('ul', { class: 'points' }, r.review_points.map((p) => h('li', {}, p)))],
        ],
    bar(secondary('Restart', () => restart(ctx)), primary('Return home', () => go('#/home'))),
  )
}

// ---------- boot ----------

addEventListener('hashchange', route)
track('app_opened') // queued until the participant code exists; sent with this load's session_id
route()
