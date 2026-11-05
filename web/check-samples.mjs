// Run: npm run check. Asserts samples mode answers like the recorded server output.
import assert from 'node:assert/strict'
import { createServer } from 'vite'

process.env.VITE_DATA_MODE = 'samples'
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const api = await vite.ssrLoadModule('/src/api.js')

  const { topics } = await api.getTopics()
  assert.equal(topics.length, 4)
  assert.deepEqual(topics[0].objectives[0].required_question_ids, ['rep-q1', 'rep-q2'])

  const q = await api.getQuestion('rep-q2')
  assert.equal(q.choices.length, 3)
  assert.ok(!('correct_choice_id' in q))

  const id = crypto.randomUUID()
  const r = await api.submitAttempt({ attempt_id: id, question_id: 'rep-q1', selected_choice_id: 'B', objective_id: 'synthesis_direction_and_primer', remediation_state: {} })
  assert.equal(r.action, 'continue_questions')
  assert.equal(r.attempt_id, id)

  await assert.rejects(
    api.submitAttempt({ attempt_id: id, question_id: 'rep-q2', selected_choice_id: 'A', objective_id: 'synthesis_direction_and_primer', remediation_state: {} }),
    (e) => e.status === 409 && e.field === 'question_id',
  )
  await assert.rejects(api.getQuestion('rep-q9'), (e) => e.status === 404)
  assert.equal((await api.startVideo({ variant_id: 'primer_followup' })).status, 'ready')
  console.log('samples mode: ok')
} finally {
  await vite.close()
}
