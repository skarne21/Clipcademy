FROM python:3.12-alpine

RUN adduser -D -u 1000 sandbox
USER sandbox
WORKDIR /home/sandbox

# Phase 3: runner script reads code + tests from stdin and exits with structured JSON.
COPY --chown=sandbox:sandbox run.py /home/sandbox/run.py
ENTRYPOINT ["python", "/home/sandbox/run.py"]
