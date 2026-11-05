// Web/src/api.js is the one network module: JSON in and out, ApiError on failure,
// and a 503 from /video-jobs (video service not mounted yet) reads as a failed job.
import assert from 'node:assert/strict'
import { browser, fakeFetch, load } from './web.mjs'

browser()
const calls = fakeFetch((url) =>
  url === '/video-jobs'
    ? { status: 503, body: { error: { field: 'path', message: 'video service not installed yet' } } }
    : url.startsWith('/questions/')
      ? { status: 404, body: { error: { field: 'question_id', message: 'unknown question' } } }
      : { status: 200, body: { topics: [] } },
)
const { mod: api, close } = await load('api.js', { VITE_DATA_MODE: 'live' })

assert.deepEqual(await api.getTopics(), { topics: [] })
assert.deepEqual(await api.startVideo({ variant_id: 'initial' }), { job_id: null, status: 'failed' })
await assert.rejects(api.getQuestion('rep q/1'), (err) => err instanceof api.ApiError && err.status === 404 && err.field === 'question_id')
assert.equal(calls.at(-1).url, '/questions/rep%20q%2F1')
await api.submitAttempt({ attempt_id: 'x' })
assert.deepEqual(calls.at(-1), { url: '/attempts', method: 'POST', body: { attempt_id: 'x' } })

await close()
console.log('ok')
