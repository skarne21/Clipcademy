// The web app sends one heartbeat per 30 s that it is actually on screen; hidden time doesn't count.
import assert from 'node:assert/strict'
import { browser, fakeClock, fakeFetch, load } from './web.mjs'

const page = browser(new Map([['clipcademy', JSON.stringify({ participant_id: 'P01' })]]))
const calls = fakeFetch()
const { clock, close } = await load('events.js', { VITE_DATA_MODE: 'live', clock: fakeClock })
const beats = () => calls.filter((c) => c.body?.event_name === 'heartbeat').length
const setVisible = (v) => {
  page.doc.visibilityState = v ? 'visible' : 'hidden'
  page.doc.dispatchEvent(new Event('visibilitychange'))
}

await clock.advance(29_000)
assert.equal(beats(), 0, 'no heartbeat before 30 s')
await clock.advance(2_000)
assert.equal(beats(), 1, 'one heartbeat after 30 s on screen')

setVisible(false)
await clock.advance(120_000)
assert.equal(beats(), 1, 'hidden time is not time on app')

setVisible(true)
await clock.advance(31_000)
assert.equal(beats(), 2)
assert.equal(calls.find((c) => c.body?.event_name === 'heartbeat').body.participant_id, 'P01')

await close()
console.log('ok')
