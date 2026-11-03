// A finished objective's home row offers Restart (the moderator's task starts with "Tap Restart"),
// with See summary still reachable; Restart starts the lesson over.
import assert from 'node:assert/strict'
import { openApp } from './web.mjs'

const ID = 'synthesis_direction_and_primer'
const finished = {
  participant_id: 'P01',
  selected_topic_ids: ['dna_replication'],
  current_objective_id: null,
  event_queue: [],
  objectives: {
    [ID]: { topic_id: 'dna_replication', remediation_state: { objective_status: 'complete' }, step: 'summary',
            video_job_id: null, last_result: null, pending_attempt: null, attempts: [] },
  },
}

const { page, url, close } = await openApp()
try {
  await page.goto(url)
  await page.evaluate((s) => localStorage.setItem('clipcademy', JSON.stringify(s)), finished)
  await page.goto(`${url}#/home`)
  await page.reload() // a hash-only goto doesn't reload, and the app reads storage once at load
  await page.waitForFunction(() => document.querySelector('.objective'), { timeout: 15000 })
  const row = await page.$eval('.objective', (li) => ({
    text: li.innerText,
    buttons: [...li.querySelectorAll('button')].map((b) => b.innerText.trim()),
  }))
  assert.match(row.text, /Complete/)
  assert.ok(row.buttons.includes('Restart'), `row buttons: ${row.buttons}`)
  assert.ok(row.buttons.includes('See summary'), `row buttons: ${row.buttons}`)

  await page.evaluate(() => [...document.querySelectorAll('.objective button')].find((b) => b.innerText.trim() === 'Restart').click())
  await page.waitForFunction(() => location.hash.startsWith('#/lesson'), { timeout: 5000 })
  const o = await page.evaluate((id) => JSON.parse(localStorage.getItem('clipcademy')).objectives[id], ID)
  assert.equal(o.remediation_state.objective_status, undefined, 'progress cleared')
} finally {
  await close()
}
console.log('ok')
