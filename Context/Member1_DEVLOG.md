# Member 1 implementation log

## Scope and branch base

`member1` starts at `MVP02` commit `b921e62`. Reviewed all three remote branches:
`main` contains the earlier product proposals; `MVP02` contains the current biology
team specification, lesson packets, learning backend and plain-JS frontend;
`member3` contains a separate React interface using the same video job fields.
This branch preserves the MVP02 app and implements the Member 1 backend hook.

## Content and visual template

Six fixed scripts cover the initial, direction and primer explanations for
replication, and the initial, timing and UV explanations for repair. Their source
references and goals come from the two lesson packets. The renderer must not accept
arbitrary learner-supplied narration. Excluded lecture passages remain excluded.
The shared template specifies one guide, labeled diagrams, colors, fonts and voice.

The packets are still `draft` and the content audit is still `pending`.
These are review assets, not evidence of course-expert approval. Do not release to
participants until the existing content-review and freeze process passes.

## Completed implementation and handoff

- Added the Python WSGI handler at the existing backend mount, persistent jobs,
  cache reuse, local asynchronous rendering, honest failures and retry recovery.
- Added six actual narrated MP4s, sidecar transcripts/captions, source-linked
  manifests, two sample request/results and a missing-asset failure example.
- Added local byte-range media delivery and Vite media proxy. The existing UI
  labels previews honestly and loads captions from the response.
- Verified 10 video/integration and 48 learning tests, six full MP4 decodes,
  frontend sample checks/build, and content consistency. Browser launch was
  denied by the execution environment, so browser and phone checks remain open.
- No study results or review approvals were fabricated. Course review and the
  existing freeze gate remain pending. See `video/README.md` for exact commands,
  response shapes, review fingerprints, hosting and Member 3 integration notes.
