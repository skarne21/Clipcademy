// Start learning/app.py with CLIPCADEMY_VIDEO_PREVIEW=1 and Vite before running.
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'
const chrome = process.env.CHROME ?? ({
 darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
 win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
}[process.platform] ?? '/usr/bin/chromium')
const browser=await puppeteer.launch({executablePath:chrome,args:['--autoplay-policy=no-user-gesture-required',...(process.env.CHROME_NO_SANDBOX==='1'?['--no-sandbox']:[])]})
try {
 const page=await browser.newPage()
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true})
 await page.goto(process.env.APP??'http://127.0.0.1:5173/')
 const result=await page.evaluate(async()=>{
  async function api(path,body){const r=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);if(!r.ok)throw Error(await r.text());return r.json()}
  const topics=await api('/topics');const o=topics.topics.find(t=>t.topic_id==='dna_replication').objectives[0]
  const initial=await api('/video-jobs',o.intro_video_requests[0])
  let state={};let followup;let action
  for(const [qid,choice] of [['rep-q1','B'],['rep-q2','B'],['rep-r2','B']]){
   const r=await api('/attempts',{attempt_id:crypto.randomUUID(),objective_id:o.objective_id,question_id:qid,selected_choice_id:choice,remediation_state:state})
   state=r.remediation_state;action=r.action
   if(r.next_video_request)followup=await api('/video-jobs',r.next_video_request)
  }
  const playback=[]
  for(const job of [initial,followup]){
   const v=document.createElement('video');v.controls=true;v.muted=true;v.playsInline=true;v.src=job.video_url;document.body.replaceChildren(v)
   await new Promise((ok,no)=>{v.onloadedmetadata=ok;v.onerror=no})
   await v.play();await new Promise(ok=>setTimeout(ok,500))
   const entry={duration:v.duration,width:v.videoWidth,height:v.videoHeight,time:v.currentTime}
   v.currentTime=v.duration-.2
   await new Promise((ok,no)=>{v.onended=ok;setTimeout(()=>no(Error('Playback timed out')),5000)})
   entry.ended=v.ended;entry.captions=(await fetch(job.captions_url).then(r=>r.text())).startsWith('WEBVTT');playback.push(entry)
  }
  return {action,variant:followup.variant_id,playback}
 })
 assert.equal(result.action,'complete');assert.equal(result.variant,'primer_followup')
 for(const p of result.playback){assert.ok(p.duration>=15&&p.duration<=30);assert.equal(p.width,720);assert.equal(p.height,1280);assert.ok(p.time>0&&p.ended&&p.captions)}
 console.log('PASS real backend: intro_1, wrong answer, primer clip, retry, completion; real browser playback',result)
} finally {await browser.close()}
