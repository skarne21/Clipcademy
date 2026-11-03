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

// Time on app (validation-plan.md): one heartbeat per 30 s that the app is actually on screen.
// Visible time is added up second by second, so a hidden tab or a locked phone pauses the count,
// and switching tabs quickly can't inflate it.
const BEAT_MS = 30_000
const MAX_STEP_MS = 5_000 // a sleeping laptop that never fired visibilitychange doesn't count as time on app
const LESSON_SCREENS = /^#\/(lesson|question|feedback|followup|summary)(\/|$)/
const CARRY_MS = 5 * 60_000 // leftover seconds survive a refresh or quick reopen, not yesterday's visit
const carry = state.heartbeat_carry
let visibleMs = carry && Date.now() - carry.at < CARRY_MS ? carry.ms : 0
let lastTick = null

// Saves the seconds not yet worth a heartbeat, so a refresh doesn't throw them away.
function saveCarry() {
  state.heartbeat_carry = { ms: visibleMs, at: Date.now() }
  save()
}

function heartbeatTick() {
  const now = Date.now()
  if (lastTick !== null) visibleMs += Math.min(now - lastTick, MAX_STEP_MS)
  lastTick = document.visibilityState === 'visible' ? now : null
  for (; visibleMs >= BEAT_MS; visibleMs -= BEAT_MS) {
    if (!state.participant_id) continue // time on the code screen isn't study time
    const id = LESSON_SCREENS.test(location.hash) ? state.current_objective_id : null
    track('heartbeat', { topic_id: id && state.objectives[id]?.topic_id, objective_id: id })
  }
}

setInterval(heartbeatTick, 1_000)
document.addEventListener('visibilitychange', () => {
  heartbeatTick()
  if (document.visibilityState === 'hidden') saveCarry() // phones often skip pagehide when a tab is swiped away
})
addEventListener('pagehide', () => {
  heartbeatTick()
  saveCarry()
})
heartbeatTick()
