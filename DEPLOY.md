# Deploying ClipCademy

Everything runs in one Docker container (US-35):
- the student app;
- the teacher page (`/teach.html`);
- the class page (`/class.html`);
- the existing biology study app;
- the background worker that makes clips (Gemini → ElevenLabs → Remotion).

You only need to provide **three settings** and **a disk**.

## The three settings

| Variable | What it is | Where to get it |
| --- | --- | --- |
| `GEMINI_API_KEY` | Reads uploaded notes and writes clip scripts and quiz questions | https://aistudio.google.com/apikey |
| `ELEVENLABS_API_KEY` | Voices each clip and times the captions | https://elevenlabs.io → Profile → API keys (needs *Text to Speech* and *Voices: read*) |
| `CLIPCADEMY_TEACHER_TOKEN` | The password teachers type on `/teach.html` | Make one up: a long random string, e.g. from `openssl rand -hex 16` |

**Optional settings:**
- `GEMINI_MODEL`: default `gemini-pro-latest`, the alias Google keeps pointed at its newest Pro model.
- `PORT`: default `8000`.
- The biology study app's existing settings (`CLIPCADEMY_BUILD_IDS`, `CLIPCADEMY_ADMIN_TOKEN`, `CLIPCADEMY_VIDEO_PREVIEW`) work as before.

## The disk

Mount persistent storage at **`/data`**. It holds:
- the course database;
- uploaded notes;
- rendered course videos;
- the study database.

Without a disk, all of that is lost when the container restarts.

## Run it on your laptop

```sh
docker build -t clipcademy .
docker run -p 8000:8000 -v clipcademy-data:/data \
  -e GEMINI_API_KEY=... -e ELEVENLABS_API_KEY=... -e CLIPCADEMY_TEACHER_TOKEN=... \
  clipcademy
```

Then open:
- http://localhost:8000/teach.html, signing in with your teacher password;
- the class link the teacher page shows, for students.

**Without Docker:**
```sh
cd web && npm ci && npm run build && cd ..
cd video/remotion && npm ci && cd ../..
GEMINI_API_KEY=... CLIPCADEMY_TEACHER_TOKEN=... python3 learning/server.py
```
In this mode the keys can also live in `video/.env`.

## Put it online

Any host that runs a Docker image **and** gives it a persistent disk works:

| Host | How |
| --- | --- |
| **Railway** | New project → Deploy from GitHub repo (it finds the Dockerfile) → Variables: the three settings → Add a Volume mounted at `/data`. |
| **Render** | New Web Service → this repo, runtime Docker → Environment: the three settings → Disks: mount path `/data`. Choose an instance with at least 2 GB RAM. |
| **Fly.io** | `fly launch` (uses the Dockerfile) → `fly volumes create clipcademy_data` → mount it at `/data` in `fly.toml` → `fly secrets set GEMINI_API_KEY=... ELEVENLABS_API_KEY=... CLIPCADEMY_TEACHER_TOKEN=...` |
| **Any VM** (Google Compute Engine, AWS Lightsail, DigitalOcean) | Install Docker, then run the `docker run` command above with `-p 80:8000 --restart unless-stopped`. |

**Sizing:**
- Rendering runs headless Chrome, so use at least **2 GB RAM**; 1 vCPU is enough.
- One 25-second clip takes about 12 s on a laptop and will be slower on a small server.
- The worker makes one course's clips at a time.

**Why not PythonAnywhere:** the free plan can't run Node or Chrome, so it can't render. You can keep the old PythonAnywhere site for the biology study and run this container for the course platform.

## What a customer does

1. **Teacher:** opens `/teach.html`, enters the teacher password and creates a course.
2. **Teacher:** uploads notes (PDF, .txt or .md, up to 18 MB each) and presses **Make clips**.
3. **The worker:** Gemini plans and writes clips and questions, ElevenLabs voices them and Remotion renders them. The page shows progress, typically a few minutes.
4. **Teacher:** watches every clip and reads every question, then approves or rejects each. Nothing reaches students until it's approved.
5. **Students:** open the class link (or `/class.html` and type the 6-character class code), watch the approved clips and answer the questions.

## Costs

Rough figures; check current prices.
- **ElevenLabs:** about 350 credits per clip (about $0.05).
- **Gemini:** one call to plan the course, one per clip and one per topic for questions, plus a retry for anything that fails the checks.
- **Hosting:** a 2 GB container or VM, typically about $5–25 a month depending on the provider.
- **Remotion:** free for individuals and companies of up to 3 people; larger companies need a licence (remotion.dev/license).

## Limits to know

- **One shared teacher password:** there are no individual teacher accounts.
- **Students are anonymous:** there are no student accounts, and their answers aren't saved.
- **Five scene types:** steps, compare, flow, term, myth/fact. Subjects that need real diagrams (circuits, maps, anatomy) would need new scene types.
- **"Review copy" stays on the video:** rendered clips carry a "Review copy" line in their sources text, as the biology clips do, even after approval.
- **One machine:** the worker runs inside the web container. For many teachers at once, run more workers or move rendering to a job service (Cloud Run Jobs, Remotion Lambda).
