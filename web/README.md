# Clipcademy web app (Member 3)

Plain JS + Vite. Builds to static files and calls the API with relative paths, so the same build works locally and on PythonAnywhere.

## Run

```sh
npm install
python ../learning/app.py        # API on :8000 (separate terminal)
npm run dev                      # app on :5173, API paths proxied to :8000
```

- Without the Python service: `VITE_DATA_MODE=samples npm run dev` answers from `learning/samples/`.
- Against the hosted API: `API_TARGET=https://clipcademy.pythonanywhere.com npm run dev`.
- On a phone on the same Wi-Fi: `npm run dev -- --host`, then open the Network URL it prints.
- Phone check before the real clips exist: `VITE_DATA_MODE=samples npm run dev -- --host`. Every clip is `e2e/clip.mp4`, a 2 s 720×1280 stand-in with the overlay's safe zones in red. The Back/count row, the side buttons and the bottom bar should sit on red, and nothing should cover the middle.

## Test

```sh
npm run check   # samples mode answers like the recorded server output
npm run e2e     # full flow in headless Chrome; setup steps at the top of e2e/run.mjs
```

## Freeze and deploy a study build

1. Set `BUILD_ID` in `src/config.js` (e.g. `study-1`). Member 2 adds the same ID to `CLIPCADEMY_BUILD_IDS`.
2. `npm run build`, then run `npm run e2e` against `npm run preview -- --host 127.0.0.1 --port 5173`.
3. Send `dist/` to Member 2, who uploads it to `web/dist` on PythonAnywhere and reloads (Member2_SPEC.md, Hosting).
4. Open the hosted link on a phone and run the walkthrough once.

A mid-study fix gets a new `BUILD_ID`.
