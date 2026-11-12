// Tiny DOM helpers shared by teach.js and class.js. Text is always set as text, never as HTML.
const nodes = (children) => children.flat(Infinity).filter((c) => c != null && c !== false)

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'value') el.value = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  el.append(...nodes(children))
  return el
}

export function mount(root, ...children) {
  root.replaceChildren(...nodes(children))
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function api(method, path, { body, token, raw, contentType } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (raw !== undefined) headers['Content-Type'] = contentType || 'application/octet-stream'
  const res = await fetch(path, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? `Request failed (${res.status})`)
  return data
}

export const remember = {
  get(key) {
    try { return localStorage.getItem(key) } catch { return null }
  },
  set(key, value) {
    try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* private window */ }
  },
}
