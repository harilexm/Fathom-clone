# Fathom clone

A meeting workspace preview built with Next.js App Router, React, TypeScript, and Tailwind CSS. Supabase Auth provides email/password, Google, and anonymous Demo sign-in with cookie-backed sessions.

## Run locally

- Install dependencies: `npm install`
- Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Keep `SUPABASE_SECRET_KEY` server-side; onboarding uses it only in server actions and route handlers.
- Apply these migrations in order: `supabase/migrations/20260924000000_create_profiles.sql`, `supabase/migrations/20260924010000_persist_onboarding.sql`, `supabase/migrations/20260924020000_calendar_settings.sql`, `supabase/migrations/20260925000000_create_meetings_schema.sql`, and `supabase/migrations/20260925010000_add_soniox_transcription.sql`. The first creates each user profile on the first authenticated request, using the Auth signup time for the 14-day trial.
- In Supabase Auth, enable Email, Google, and Anonymous Sign-Ins. Configure Google credentials in Supabase and add `http://localhost:3000/auth/callback` to the allowed redirect URLs. Set `NEXT_PUBLIC_SITE_URL` to the deployed origin in production and allow its `/auth/callback` URL as well.
- To enable Calendar connection, enable the Google Calendar API, create a Google OAuth web client with `http://localhost:3000/onboarding/calendar/callback` as an authorized redirect URI, and set `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, and `GOOGLE_CALENDAR_TOKEN_KEY` in `.env.local`. Generate the key with 32 random bytes encoded as Base64. This is a separate Google consent flow from Supabase sign-in and requests only read-only Calendar access. Use the deployed callback URL in production.
- Start the app: `npm run dev`
- Open http://localhost:3000

Private workspace routes require a verified Supabase session and completed onboarding. New users go through five setup steps at `/onboarding`; each choice and progress are saved to their profile. Calendar consent is optional. Skipped or denied access leaves `calendar_connected` false. The server stores an encrypted Google refresh token only after read-only Calendar access is verified. Settings shows the connected Google account when its primary Calendar ID is an email, and lets users disconnect or reconnect. Disconnect removes the stored credential and marks Calendar not connected. Returning users who completed setup go to My Calls. Email signup may require confirmation, depending on the Supabase project setting. Google OAuth returns through `/auth/callback`. Demo uses a real Supabase anonymous user, which cannot be recovered after logout unless another sign-in method is linked.

Meeting content is still local sample data shared by the preview. Recording, AI answers, meeting persistence, private sharing, billing, and row-level ownership for meeting content are not connected yet. The saved meeting and sharing preferences do not activate those features.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm run build`

On Windows, the Next CLI scripts use the installed SWC WASM compiler because this workspace's native SWC DLL cannot initialize. Other platforms run Next normally.

Development and production use separate build directories so a running dev server does not overwrite production route checks.
