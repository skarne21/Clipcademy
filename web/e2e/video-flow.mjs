// Real UI + real services; start the preview backend and Vite first.
// Uses an isolated browser context per viewport. No API responses are mocked.
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'

const chrome = process.env.CHROME ?? ({
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
}[process.platform] ?? '/usr/bin/chromium')
const browser = await puppeteer.launch({ executablePath: chrome, args: ['--autoplay-policy=no-user-gesture-required'] })
try {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.createBrowserContext()
    try {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setViewport(viewport)
      const waitText = text => page.waitForFunction(text => document.body.innerText.includes(text), {}, text)
      async function click(label) {
        const button = await page.waitForFunction(label => [...document.querySelectorAll('button,a,label')]
          .find(el => el.innerText.trim() === label && !el.disabled), {}, label)
        await button.click()
      }
      async function answer(choice, feedback) {
        await page.waitForSelector(`input[value="${choice}"]`)
        await page.click(`input[value="${choice}"]`)
        await click('Submit')
        await waitText(feedback)
      }
      async function play(variant) {
        await page.waitForFunction(variant => {
          const video = document.querySelector('video')
          return video?.src.includes(`.${variant}.`) && video.readyState >= 1
        }, {}, variant)
        await waitText('Team review copy: content approval pending.')
        const metadata = await page.$eval('video', async video => {
          video.muted = true
          await video.play()
          await new Promise(resolve => setTimeout(resolve, 400))
          const result = { width: video.videoWidth, height: video.videoHeight, duration: video.duration, time: video.currentTime,
            captions: video.querySelector('track')?.src }
          video.currentTime = video.duration - .2
          return result
        })
        assert.deepEqual([metadata.width, metadata.height], [720, 1280]) // vertical 9:16 (notes.md)
        assert.ok(metadata.duration >= 15 && metadata.duration <= 30)
        assert.ok(metadata.time > 0 && metadata.captions?.endsWith('.vtt'))
        await page.waitForFunction(() => document.querySelector('video').currentTime < 1) // looped back to the start
        const overflows = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        assert.equal(overflows, false, 'lesson fits the viewport')
      }
      await page.goto(process.env.APP ?? 'http://127.0.0.1:5173/')
      await page.waitForSelector('#code')
      await page.type('#code', 'REVIEW')
      await click('Continue')
      await click('DNA replication\nReady to review')
      await click('Continue')
      await click('Start')
      await play('intro_1')
      await click('Answer the question')
      await answer('B', 'Correct')
      await click('Next question')
      await answer('B', 'Not quite')
      await click('Watch explanation')
      await play('primer_followup')
      await click('Answer the question')
      await page.waitForFunction(() => location.hash.includes('rep-r2'))
      await answer('B', 'Correct')
      await click('See summary')
      await waitText('Complete')
      await page.reload()
      await waitText('Complete')
      await click('Return home')
      await waitText('See summary')
      assert.deepEqual(errors, [])
      console.log(`PASS ${viewport.width}px real UI: narrated intro clip, wrong answer, targeted clip, fresh retry, completion and refresh`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}
