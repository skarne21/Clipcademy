// Activity events for the validation study. Each one is queued in storage first, so a
// failed send is retried later with its original event_id and client_timestamp_utc.
import { sendEvent } from './api.js'
import { BUILD_ID } from './config.js'
import { state, save } from './store.js'

const sessionId = crypto.randomUUID()

export function track(event_name, fields = {}) {
  const event = {
    event_id: crypto.randomUUID(),
    participant_id: state.participant_id,
    session_id: sessionId,
    event_name,
    client_timestamp_utc: new Date().toISOString(),
    build_id: BUILD_ID,
  }
  for (const [k, v] of Object.entries(fields)) if (v != null) event[k] = v
  state.event_queue.push(event)
  save()
  flush()
}

let flushing = false

// Sends queued events in order. Never awaited by the UI, so it can't block the student.
export async function flush() {
  if (flushing || !state.participant_id) return
  flushing = true
  try {
    while (state.event_queue.length) {
      const event = state.event_queue[0]
      event.participant_id ??= state.participant_id // the first app_opened is queued before the code is entered
      try {
        await sendEvent(event) // 201 stored, 200 duplicate: both done
      } catch (err) {
        if (!err.status || err.status >= 500) break // offline or server trouble: retry later
        console.warn(`Dropped event ${event.event_name}: ${err.field} ${err.message}`) // resending won't fix a 4xx
      }
      state.event_queue.shift()
      save()
    }
  } finally {
    flushing = false
  }
}

setInterval(flush, 30_000)
addEventListener('online', flush)
