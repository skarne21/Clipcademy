// Events are queued in storage first and retried with their original id when the server
// is down; a 4xx is dropped (resending can't fix it); Reset demo keeps the participant and unsent events.
import assert from 'node:assert/strict'
import { browser, fakeClock, fakeFetch, load, settle } from './web.mjs'

const page = browser(new Map([['clipcademy', JSON.stringify({ participant_id: 'P01' })]]))
let reply = { status: 500, body: { error: { message: 'down' } } }
const calls = fakeFetch(() => reply)
const { mod: events, other, close } = await load('events.js', { VITE_DATA_MODE: 'live', clock: fakeClock })
const store = await other('store.js')

events.track('topic_selected', { topic_id: 'dna_replication', objective_id: null })
await settle()
const queued = page.saved().event_queue
assert.equal(queued.length, 1, 'kept in storage while the server is down')
assert.equal(queued[0].participant_id, 'P01')
assert.equal(queued[0].topic_id, 'dna_replication')
assert.ok(!('objective_id' in queued[0]), 'null fields are left out')
const { event_id, client_timestamp_utc } = queued[0]

reply = { status: 201, body: {} }
await events.flush()
assert.equal(page.saved().event_queue.length, 0)
assert.equal(calls.at(-1).body.event_id, event_id, 'retried with the same event_id')
assert.equal(calls.at(-1).body.client_timestamp_utc, client_timestamp_utc)

reply = { status: 400, body: { error: { field: 'topic_id', message: 'bad' } } }
console.warn = () => {}
events.track('topic_selected', { topic_id: 'nope' })
await settle()
assert.equal(page.saved().event_queue.length, 0, 'a 4xx is dropped, not retried forever')

store.state.selected_topic_ids = ['dna_replication']
store.state.objectives = { synthesis_direction_and_primer: store.newObjective('dna_replication') }
store.state.event_queue.push({ event_name: 'unsent' })
store.resetDemo()
const after = page.saved()
assert.deepEqual([after.participant_id, after.selected_topic_ids, after.objectives], ['P01', [], {}])
assert.equal(after.event_queue.length, 1, 'unsent events survive Reset demo')

await close()
console.log('ok')
