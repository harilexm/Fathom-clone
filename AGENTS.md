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

## Reliability
- Retries/webhooks must be idempotent.
- Never create duplicate meeting results or deduct credits twice.
- Deduct credits only after successful media processing.
- Failed processing uses 0 credits.
- Avoid unnecessary libraries, abstractions, or duplicate implementations.
- Clearly label anything that is stubbed/demo-only.

## 8x / Git
- Never ignore, delete, rewrite, or fabricate `.agent-logs/`.
- Keep capture evidence intact.
- Check `git status` before commits.
- Never commit secrets or generated junk.

## Verification
Before marking a step complete:
- run the relevant checks/tests
- test the main success path
- test important failure/security cases
- fix issues found
- rerun verification
- report both what passed and any remaining failures or limitations clearly