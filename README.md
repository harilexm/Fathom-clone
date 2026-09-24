# Fathom clone

A meeting workspace preview built with Next.js App Router, React, TypeScript, and Tailwind CSS. Supabase Auth provides email/password, Google, and anonymous Demo sign-in with cookie-backed sessions.

## Run locally

- Install dependencies: `npm install`
- Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Keep `SUPABASE_SECRET_KEY` server-side; this auth flow does not use it.
- Apply `supabase/migrations/20260924000000_create_profiles.sql` to your Supabase project before signing in. It creates each user profile on the first authenticated workspace request, using the Auth signup time for the 14-day trial.
- In Supabase Auth, enable Email, Google, and Anonymous Sign-Ins. Configure Google credentials in Supabase and add `http://localhost:3000/auth/callback` to the allowed redirect URLs. Set `NEXT_PUBLIC_SITE_URL` to the deployed origin in production and allow its `/auth/callback` URL as well.
- Start the app: `npm run dev`
- Open http://localhost:3000

Private workspace routes require a verified Supabase session. Authenticated visitors to the login page go to My Calls. Email signup may require confirmation, depending on the Supabase project setting. Google OAuth returns through `/auth/callback`. Demo uses a real Supabase anonymous user, which cannot be recovered after logout unless another sign-in method is linked.

Meeting content is still local sample data shared by the preview. Recording, AI answers, persistence, private sharing, billing, and row-level ownership are not connected yet.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm run build`

On Windows, the Next CLI scripts use the installed SWC WASM compiler because this workspace's native SWC DLL cannot initialize. Other platforms run Next normally.

Development and production use separate build directories so a running dev server does not overwrite production route checks.
