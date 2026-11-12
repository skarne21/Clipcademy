// Home page (US-48): students type a class code, teachers type the teacher password.
import '../style.css'
import './platform.css'
import { api, h, mount, remember } from './dom.js'

const app = document.getElementById('app')

function form({ id, label, fieldLabel, inputId, inputAttrs, button, buttonId, onsubmit }) {
  const input = h('input', { id: inputId, class: 'field', autocomplete: 'off', ...inputAttrs })
  const message = h('p', { class: 'error-text', role: 'alert' })
  return h('section', { class: 'panel', 'aria-labelledby': id },
    h('h2', { id }, label),
    h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault()
      message.textContent = (await onsubmit(input.value.trim())) ?? ''
    } },
      h('label', { for: inputId, class: 'field-label' }, fieldLabel),
      input, message,
      h('button', { type: 'submit', class: 'primary', id: buttonId }, button)))
}

async function joinClass(raw) {
  const code = raw.toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(code)) return 'Class codes are 6 letters and numbers.'
  try {
    await api('GET', `/courses/${code}`)
  } catch (err) {
    return err.status === 404 ? `No class has the code ${code}. Check it with your teacher.` : `Couldn't check that code. ${err.message}`
  }
  location.href = `/class.html#${code}`
}

async function signIn(password) {
  if (!password) return 'Type the teacher password.'
  try {
    await api('GET', '/teacher/courses', { token: password })
  } catch (err) {
    return err.status === 401 ? 'That password isn’t right.' : `Couldn't sign in. ${err.message}`
  }
  remember.set('clipcademy-teacher-token', password) // the key teach.js reads
  location.href = '/teach.html'
}

mount(app,
  h('h1', {}, 'ClipCademy'),
  h('p', { class: 'lede' }, 'Short stick-figure clips from your class notes, each followed by a question.'),
  form({ id: 'join-heading', label: 'Join a class', inputId: 'class-code', buttonId: 'join', button: 'Join',
    fieldLabel: 'Class code from your teacher', inputAttrs: { maxlength: '6', autocapitalize: 'characters', placeholder: 'FJ65HA' },
    onsubmit: joinClass }),
  form({ id: 'teacher-heading', label: 'Teacher sign in', inputId: 'teacher-password', buttonId: 'sign-in', button: 'Sign in',
    fieldLabel: 'Teacher password', inputAttrs: { type: 'password' }, onsubmit: signIn }),
  h('p', { class: 'note' }, 'Taking part in the biology study? ', h('a', { href: '/index.html' }, 'Open the study app'), '.'))
