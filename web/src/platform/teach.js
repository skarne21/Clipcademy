// Teachers (US-30, US-31, US-44): create a course, upload notes, make clips; delete any clip or question students shouldn’t see.
import '../style.css'
import './platform.css'
import { api, h, mount, remember } from './dom.js'

const app = document.getElementById('app')
const KEY = 'clipcademy-teacher-token'
let token = remember.get(KEY)
let poll = null

const call = (method, path, opts = {}) => api(method, path, { ...opts, token })
const go = (hash) => (location.hash === hash ? route() : (location.hash = hash))
const badge = (status) => h('span', { class: `badge badge-${status}` }, status)
const when = (iso) => (iso ? new Date(iso).toLocaleString() : '')

function fail(err) {
  if (err.status === 401) {
    remember.set(KEY, null)
    token = null
    return signIn(err.message)
  }
  mount(app, h('h1', {}, 'Something went wrong'), h('p', { class: 'error-text', role: 'alert' }, err.message),
    h('button', { type: 'button', class: 'secondary', onclick: route }, 'Try again'))
}

function signIn(message) {
  let input
  mount(app,
    h('h1', {}, 'ClipCademy for teachers'),
    h('p', { class: 'lede' }, 'Upload your class notes and get short stick-figure clips and practice questions. They go straight to your class, and you can delete any you don’t want.'),
    h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault()
      token = input.value.trim()
      remember.set(KEY, token)
      route()
    } },
      h('label', { for: 'pw', class: 'field-label' }, 'Teacher password'),
      (input = h('input', { id: 'pw', class: 'field', type: 'password', autocomplete: 'current-password' })),
      message && h('p', { class: 'error-text', role: 'alert' }, message),
      h('button', { type: 'submit', class: 'primary' }, 'Sign in')))
  input.focus()
}

async function coursesScreen() {
  const { courses } = await call('GET', '/teacher/courses')
  let title
  const create = async (e) => {
    e.preventDefault()
    if (!title.value.trim()) return title.focus()
    try {
      const course = await call('POST', '/teacher/courses', { body: { title: title.value.trim() } })
      go(`#course/${course.course_id}`)
    } catch (err) { fail(err) }
  }
  mount(app,
    h('div', { class: 'topline' }, h('h1', {}, 'Your courses'),
      h('button', { type: 'button', class: 'link', onclick: () => { remember.set(KEY, null); token = null; signIn() } }, 'Sign out')),
    h('form', { class: 'inline-form', onsubmit: create },
      h('label', { for: 'title', class: 'visually-hidden' }, 'New course title'),
      (title = h('input', { id: 'title', class: 'field', placeholder: 'New course title, e.g. Intro Economics', maxlength: '120' })),
      h('button', { type: 'submit', class: 'primary' }, 'Create course')),
    courses.length
      ? h('ul', { class: 'cards' }, courses.map((c) => h('li', {},
        h('a', { class: 'card-button', href: `#course/${c.course_id}` },
          h('span', { class: 'row-title' }, c.title),
          h('span', { class: 'row-sub' }, `Class code ${c.join_code} · created ${when(c.created_at)}`)))))
      : h('p', { class: 'note' }, 'No courses yet. Create one to upload notes.'))
  title.focus()
}

async function upload(courseId, files, status) {
  for (const file of files) {
    status.textContent = `Uploading ${file.name}…`
    try {
      await call('PUT', `/teacher/courses/${courseId}/materials/${encodeURIComponent(file.name)}`, { raw: file, contentType: file.type })
    } catch (err) {
      if (err.status === 401) return fail(err)
      status.textContent = `${file.name}: ${err.message}`
      return
    }
  }
  status.textContent = ''
  route()
}

function jobPanel(courseId, job, materials) {
  const busy = job && (job.status === 'queued' || job.status === 'running')
  const start = async () => {
    try {
      await call('POST', `/teacher/courses/${courseId}/generate`, { body: {} })
      route()
    } catch (err) { err.status === 401 ? fail(err) : alert(err.message) }
  }
  const skipped = job?.report?.skipped ?? []
  return h('section', { class: 'panel', 'aria-live': 'polite' },
    h('h2', {}, '2. Make clips'),
    job
      ? h('p', {}, badge(job.status), ' ', job.stage ?? '', job.message ? h('span', { class: 'block note' }, job.message) : null)
      : h('p', { class: 'note' }, 'Gemini reads your notes, writes short clips and questions, and the clips are voiced and animated. This takes a few minutes.'),
    skipped.length > 0 && h('details', {}, h('summary', {}, `${skipped.length} item${skipped.length === 1 ? '' : 's'} skipped`),
      h('ul', {}, skipped.map((s) => h('li', { class: 'note' }, `${s.variant_id ?? s.objective_id ?? ''}: ${s.reason ?? ''}`)))),
    h('button', { type: 'button', class: 'primary', disabled: busy || !materials.length, onclick: start },
      busy ? 'Working…' : job ? 'Make clips again' : 'Make clips'),
    job && job.status === 'done' && h('p', { class: 'note' }, 'Making clips again replaces this course’s clips and questions.'))
}

function remove(kind, id) {
  // Two taps, like the MVP's Reset demo, so a stray click can't delete (and no blocking confirm dialog).
  return async (e) => {
    const button = e.currentTarget
    if (!button.dataset.armed) {
      button.dataset.armed = '1'
      button.textContent = 'Tap again to delete'
      return
    }
    try {
      await call('DELETE', `/teacher/${kind}/${id}`)
      route()
    } catch (err) { fail(err) }
  }
}

function clipCard(c) {
  return h('article', { class: 'item-card' },
    h('div', { class: 'item-media' },
      h('video', { src: c.video_url, controls: true, playsinline: true, preload: 'metadata', class: 'clip-preview' },
        h('track', { kind: 'captions', src: c.captions_url, srclang: 'en', label: 'English' }))),
    h('div', { class: 'item-body' },
      h('div', { class: 'topline' }, h('h3', {}, c.title)),
      h('p', { class: 'note' }, `${c.variant_id} · ${c.template} scene · ${c.duration_seconds ? Math.round(c.duration_seconds) + ' s' : ''}`),
      h('p', {}, h('strong', {}, 'Teaches: '), c.teaching_goal),
      h('details', {}, h('summary', {}, 'Narration and sources'),
        h('p', {}, c.transcript),
        h('p', { class: 'note' }, `Sources: ${c.source_refs.join(', ')}`)),
      h('div', { class: 'item-actions' },
        h('button', { type: 'button', class: 'secondary', onclick: remove('clips', c.clip_id) }, 'Delete'))))
}

function questionCard(q) {
  return h('article', { class: 'item-card' },
    h('div', { class: 'item-body' },
      h('div', { class: 'topline' }, h('h3', {}, q.prompt)),
      h('ol', { class: 'answer-list' }, q.choices.map((c) => h('li', { class: c.choice_id === q.correct_choice_id ? 'is-right' : '' },
        h('strong', {}, `${c.choice_id}. ${c.text}`), c.choice_id === q.correct_choice_id ? ' (correct)' : '',
        h('span', { class: 'block note' }, q.feedback[c.choice_id] ?? '')))),
      h('p', { class: 'note' }, `Sources: ${q.source_refs.join(', ')}`),
      h('div', { class: 'item-actions' },
        h('button', { type: 'button', class: 'secondary', onclick: remove('questions', q.question_id) }, 'Delete'))))
}

// US-47: how Gemini split the notes into topics, shown as soon as it has (while clips are still being made).
function topicsPanel(topics) {
  if (!topics?.length) return null
  return h('section', { class: 'panel' },
    h('h2', {}, 'Topics from your notes'),
    h('p', { class: 'note' }, `Gemini found ${topics.length} topic${topics.length === 1 ? '' : 's'}. Each gets intro clips, and a follow-up clip for each common mistake.`),
    topics.map((t, i) => h('details', { class: 'topic', open: i === 0 },
      h('summary', {}, h('strong', {}, t.label), h('span', { class: 'note' }, ` · ${t.clips.length} intro clips · ${t.misconceptions.length} mistakes`)),
      h('h3', { class: 'field-label' }, 'From your notes'),
      h('ul', {}, t.excerpts.map((e) => h('li', {}, `“${e.text}” `, h('span', { class: 'note' }, e.ref)))),
      h('h3', { class: 'field-label' }, 'Intro clips teach'),
      h('ol', {}, t.clips.map((c) => h('li', {}, c.teaching_goal))),
      t.misconceptions.length > 0 && [h('h3', { class: 'field-label' }, 'Mistakes a wrong answer is checked for'),
        h('ul', {}, t.misconceptions.map((m) => h('li', {}, m.label)))])))
}

async function courseScreen(courseId) {
  const view = await call('GET', `/teacher/courses/${courseId}`)
  const { course, materials, job, clips, questions } = view
  const link = `${location.origin}${view.share_path}`
  const status = h('p', { class: 'note', 'aria-live': 'polite' })
  const files = h('input', { type: 'file', id: 'files', multiple: true, accept: '.pdf,.txt,.md', class: 'visually-hidden',
    onchange: (e) => upload(course.course_id, [...e.target.files], status) })
  const groups = {}
  for (const c of clips) (groups[c.objective_id] ??= []).push(c)
  mount(app,
    h('a', { href: '#', class: 'back-link' }, '← Courses'),
    h('h1', {}, course.title),
    h('section', { class: 'panel share' },
      h('p', {}, 'Students join at ', h('a', { href: link, target: '_blank', rel: 'noopener' }, link), ' with class code ', h('strong', { class: 'code' }, course.join_code)),
      h('button', { type: 'button', class: 'secondary', onclick: async (e) => {
        try { await navigator.clipboard.writeText(link); e.target.textContent = 'Copied' } catch { e.target.textContent = 'Copy failed' }
      } }, 'Copy link')),
    h('section', { class: 'panel' },
      h('h2', {}, '1. Upload notes'),
      h('p', { class: 'note' }, 'PDF (slides exported as PDF work too), .txt or .md, up to 18 MB each.'),
      materials.length ? h('ul', { class: 'file-list' }, materials.map((m) => h('li', {}, m.name, h('span', { class: 'note' }, ` ${Math.ceil(m.size / 1024)} KB`)))) : null,
      h('label', { for: 'files', class: 'secondary as-button' }, 'Choose files'), files, status),
    jobPanel(course.course_id, job, materials),
    topicsPanel(view.topics),
    h('section', {},
      h('h2', {}, '3. Clips'),
      h('p', { class: 'note' }, clips.length ? `${clips.length} clips, live for your class. Delete any you don’t want students to see.` : 'Clips appear here when they’re ready.'),
      Object.values(groups).map((list) => h('div', { class: 'clip-group' },
        list.map(clipCard)))),
    h('section', {},
      h('h2', {}, '4. Questions'),
      questions.length ? [h('p', { class: 'note' }, `${questions.length} questions, live for your class.`), questions.map(questionCard)] : h('p', { class: 'note' }, 'Questions appear here when they’re ready.')))
  if (job && (job.status === 'queued' || job.status === 'running')) poll = setTimeout(route, 3000)
}

async function route() {
  clearTimeout(poll)
  if (!token) return signIn()
  const [, courseId] = location.hash.match(/^#course\/([a-z0-9_]+)$/) ?? []
  try {
    await (courseId ? courseScreen(courseId) : coursesScreen())
  } catch (err) {
    fail(err)
  }
}

addEventListener('hashchange', route)
route()
