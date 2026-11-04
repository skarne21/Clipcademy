// Everything the app remembers lives in one localStorage key. If storage is unavailable
// (private window, blocked site data) the app still works for the current tab.
const KEY = 'clipcademy'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

export const state = {
  participant_id: null,
  selected_topic_ids: [],
  objectives: {},
  current_objective_id: null,
  event_queue: [],
  ...load(),
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // keep working in memory
  }
}

export const newObjective = (topic_id) => ({
  topic_id,
  remediation_state: {}, // stored exactly as the server returns it, never edited here
  step: 'lesson', // lesson | question | feedback | followup | summary
  video_jobs: {}, // variant_id -> job_id, so a refresh polls the same job
  clip_index: 0, // which clip of the feed is on screen
  last_result: null,
  pending_attempt: null,
  attempts: [],
})

// Reset demo keeps the participant code and any events not yet sent.
export function resetDemo() {
  Object.assign(state, { selected_topic_ids: [], objectives: {}, current_objective_id: null })
  save()
}
