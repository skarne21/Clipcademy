import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Local: `python learning/app.py` (biology app only) or `python learning/server.py` (everything, incl. courses).
// Against the hosted API: API_TARGET=https://clipcademy.pythonanywhere.com npm run dev
const target = process.env.API_TARGET ?? 'http://localhost:8000'
const apiPaths = ['/topics', '/questions', '/attempts', '/events', '/video-jobs', '/media',
  '/teacher/', '/courses/', '/course-media']

export default defineConfig({
  server: {
    proxy: Object.fromEntries(apiPaths.map((p) => [p, { target, changeOrigin: true }])),
    fs: { allow: ['..'] }, // samples mode reads ../learning/samples
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        teach: resolve(import.meta.dirname, 'teach.html'),
        class: resolve(import.meta.dirname, 'class.html'),
      },
    },
  },
})
