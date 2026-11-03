// The only module that talks to the network. Every other file calls these functions.
import { DATA_MODE } from './config.js'

export class ApiError extends Error {
  constructor(status, error) {
    super(error?.message ?? `Request failed (${status})`)
    this.status = status
    this.field = error?.field ?? null
  }
}

async function request(method, path, body) {
  if (DATA_MODE === 'samples') return fromSamples(method, path, body)
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data?.error)
  return data
}

export const getTopics = () => request('GET', '/topics')
export const getQuestion = (id) => request('GET', `/questions/${encodeURIComponent(id)}`)
export const submitAttempt = (body) => request('POST', '/attempts', body)
export const sendEvent = (event) => request('POST', '/events', event)
export const getVideo = (jobId) => request('GET', `/video-jobs/${encodeURIComponent(jobId)}`)

// 503 means Member 1's video service isn't mounted yet: treat it like a failed job.
export async function startVideo(videoRequest) {
  try {
    return await request('POST', '/video-jobs', videoRequest)
  } catch (err) {
    if (err.status === 503) return { job_id: null, status: 'failed' }
    throw err
  }
}

// Samples mode: answer from the recorded server output in learning/samples/.
// ponytail: only requests that exactly match a recorded one are answered; anything else throws.
const samples = import.meta.glob('../../learning/samples/*.json', { import: 'default' })

async function fromSamples(method, path, body) {
  if (path === '/events') return { event_id: body.event_id, duplicate: false }
  if (path.startsWith('/video-jobs')) {
    // ponytail: fake ready job until Member 1 ships a sample MP4 and /video-jobs.
    const variant_id = body?.variant_id ?? 'initial'
    return { job_id: `sample-${variant_id}`, status: 'ready', variant_id, video_url: '/media/sample.mp4', transcript: 'Sample transcript.', source_refs: [] }
  }
  for (const load of Object.values(samples)) {
    const s = await load()
    if (s.request.method !== method || s.request.path !== path) continue
    if (body && !sameAttempt(s.request.body, body)) continue
    if (s.status >= 400) throw new ApiError(s.status, s.response.error)
    return body ? { ...s.response, attempt_id: body.attempt_id } : s.response
  }
  throw new ApiError(404, { field: 'path', message: `No sample for ${method} ${path}` })
}

const sameAttempt = (a, b) =>
  a.question_id === b.question_id &&
  a.selected_choice_id === b.selected_choice_id &&
  JSON.stringify(a.remediation_state) === JSON.stringify(b.remediation_state)
