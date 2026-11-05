// On-screen seconds not yet worth a heartbeat survive a refresh: 20 s, refresh, 14 s -> one heartbeat.
import assert from 'node:assert/strict'
import { browser, fakeClock, fakeFetch, load } from './web.mjs'

const store = new Map([['clipcademy', JSON.stringify({ participant_id: 'P01' })]])
const calls = fakeFetch()
const beats = () => calls.filter((c) => c.body?.event_name === 'heartbeat').length

// first page load: 20 s on screen, then the page is closed or refreshed
let page = browser(store)
const first = await load('events.js', { VITE_DATA_MODE: 'live', clock: fakeClock })
const clock = first.clock
await clock.advance(20_000)
page.win.dispatchEvent(new Event('pagehide'))
await first.close()
assert.equal(beats(), 0)

// second page load, same storage
page = browser(store)
clock.timers.length = 0 // the old page's timers die with it
const second = await load('events.js', { VITE_DATA_MODE: 'live', clock: () => clock })
await clock.advance(14_000)
assert.equal(beats(), 1, '20 s + 14 s across a refresh is one heartbeat')
await second.close()
console.log('ok')
