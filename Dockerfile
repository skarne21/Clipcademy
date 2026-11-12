# ClipCademy in one container (US-35): web pages, biology app, course platform, background worker and
# the Remotion renderer. Configure with environment variables only; mount a disk at /data.
#   docker build -t clipcademy .
#   docker run -p 8000:8000 -v clipcademy-data:/data \
#     -e GEMINI_API_KEY=... -e ELEVENLABS_API_KEY=... -e CLIPCADEMY_TEACHER_TOKEN=... clipcademy

# 1. Build the web pages (student app, teach.html, class.html).
FROM node:20-bookworm-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
COPY learning/samples /app/learning/samples
RUN npx vite build

# 2. Runtime: Python for the server, Node + headless Chrome for Remotion.
FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates fonts-dejavu-core \
        libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 libxrandr2 libxkbcommon0 \
        libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=web /usr/local/bin/node /usr/local/bin/node
COPY --from=web /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

WORKDIR /app
COPY video/remotion/package.json video/remotion/package-lock.json video/remotion/
RUN cd video/remotion && npm ci && npx remotion browser ensure
COPY . .
COPY --from=web /app/web/dist web/dist

ENV CLIPCADEMY_DATA=/data \
    CLIPCADEMY_WEB_DIST=/app/web/dist \
    PORT=8000 \
    PYTHONUNBUFFERED=1
VOLUME /data
EXPOSE 8000
CMD ["python3", "learning/server.py"]
