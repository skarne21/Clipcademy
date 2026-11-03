import { defineConfig } from 'vite'

// Local: `python learning/app.py`. Against the hosted API: API_TARGET=https://clipcademy.pythonanywhere.com npm run dev
const target = process.env.API_TARGET ?? 'http://localhost:8000'
const apiPaths = ['/topics', '/questions', '/attempts', '/events', '/video-jobs']

export default defineConfig({
  server: {
    proxy: Object.fromEntries(apiPaths.map((p) => [p, { target, changeOrigin: true }])),
    fs: { allow: ['..'] }, // samples mode reads ../learning/samples
  },
})
