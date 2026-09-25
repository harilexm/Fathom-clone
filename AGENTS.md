## Core Rules
- Never commit `.env.local`, API keys, tokens, or secrets.
- `.env.example` must contain placeholders only.
- Never expose server secrets through `NEXT_PUBLIC_*`.
- Never print/log secrets in code, tests, docs, responses, or `.agent-logs/`.

## Security
- Keep privileged provider calls server-side.
- Browser must never receive permanent R2, OpenAI, Anthropic, Soniox, or Supabase secret credentials.
- Keep R2 private and use signed/scoped access for uploads/playback.
- Enforce user ownership, plans, and credits server-side.
- Use Supabase RLS for private data.

## Reliability & Feature Conventions
- Retries/webhooks must be idempotent.
- Never create duplicate meeting results or deduct credits twice.
- Deduct credits only after successful media processing.
- Failed processing uses 0 credits.
- Avoid unnecessary libraries, abstractions, or duplicate implementations.
- Clearly label anything that is stubbed/demo-only.
- Strictly separate demo/sample fixtures from authenticated user uploads; real meetings must render genuine pending, processing, or unavailable states, never fallback demo text or sample share links.
- Ensure media metadata (e.g. video/audio duration) pipelines are resilient and self-healing with multi-layer fallbacks (metadata parsing, container atom probing, transcript timestamps, and client sync).
- Highlights: Prevent duplicate saves and keep AI-suggested highlights distinct from user-created highlights.
- Sharing: Generate unique cryptographically secure tokens; unshared/revoked links must reject public access.
- Global Search: Strictly scope searches server-side to the authenticated user's own meetings across titles, participants, transcripts, summaries, and action items. Transcript matches must return relevant snippets, timestamps, and context-jumping URLs (`?t=...&tab=transcript`).

## 8x / Git
- Never ever modify, delete, stage, or commit files in `.agent-logs/`.
- Keep capture evidence intact.
- Check `git status` before commits.
- Never commit secrets or generated junk.
- Commit Workflow:
  - First, identify which file/files make up a specific feature/topic and stage only those files.
  - Commit message format:
    - Title: The heading/topic of that feature.
    - Description: Proper explanation of that feature/topic so anyone can understand what work was done.

## Verification
Before marking a step complete:
- run the relevant checks/tests
- test the main success path
- test important failure/security cases
- fix issues found
- rerun verification
- report both what passed and any remaining failures or limitations clearly