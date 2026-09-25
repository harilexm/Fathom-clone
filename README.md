# Fathom Clone — AI Meeting Intelligence Platform

An end-to-end meeting intelligence platform built with **Next.js 15 App Router**, **React 19**, **TypeScript**, and **Tailwind CSS**. Fathom Clone records, transcribes, summarizes, and indexes your video and audio meetings with speaker diarization, AI-generated action items, synchronized transcripts, timestamped highlights, Ask Fathom Q&A, and secure link sharing.

---

## Features

- **Media Storage & Processing**: Private, direct-to-storage uploads and secure signed playback via **Cloudflare R2** (S3-compatible).
- **High-Accuracy Diarized Transcription**: Automatic speech-to-text with multi-speaker diarization and webhook ingestion via **Soniox**.
- **AI Meeting Intelligence**: Executive summaries, categorized action items, and auto-generated highlights powered by **OpenAI** (GPT-4o/5) or **Anthropic** (Claude 3.5/Sonnet).
- **Interactive Meeting Workspace**:
  - Resilient video/audio player with playback speed control.
  - Synchronized transcript view with instant video timestamp seeking.
  - Create, edit, and trim meeting highlights.
  - **Ask Fathom**: Contextual meeting chat engine providing sourced answers linked to exact timestamps.
- **Global Contextual Search**: Server-side scoped search querying titles, attendees, summaries, and transcripts with one-click timestamp jumping (`?t=...&tab=transcript`).
- **Cryptographic Share Links**: Secure token-based public sharing for complete meetings or trimmed video highlight clips with revocation controls.
- **Google Calendar Sync**: Optional Google OAuth consent flow with encrypted token storage (AES-256-GCM) to preview upcoming meetings.
- **Credit & Trial Engine**: 50 complimentary meeting minutes on signup with idempotent credit deduction only after successful media processing.
- **Modern Black Theme**: Polished, low-contrast dark interface (`#06080d`) with ambient glowing highlights and zero generic AI slop.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, Server Actions, Route Handlers) |
| **UI & Styling** | [React 19](https://react.dev/), [Tailwind CSS v3](https://tailwindcss.com/), [Lucide React Icons](https://lucide.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict Mode) |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security, SSR Cookie Auth) |
| **Object Storage** | [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) (Private bucket with presigned URLs) |
| **Speech-to-Text** | [Soniox API](https://soniox.com/) (Speech recognition & speaker diarization) |
| **AI / LLMs** | [OpenAI API](https://platform.openai.com/) / [Anthropic API](https://console.anthropic.com/) |
| **Calendar Interop**| [Google Calendar API](https://developers.google.com/calendar) (OAuth 2.0 Web Client) |

---

## Prerequisites

Before setting up the project locally, ensure you have:

1. **Node.js**: `v18.18.0` or higher (Node 20+ recommended).
2. **Package Manager**: `npm` (comes with Node.js).
3. **Supabase Account**: A free Supabase project for PostgreSQL and authentication.
4. **Cloudflare R2 Bucket**: An R2 bucket for storing meeting audio/video files (or any S3-compatible bucket).
5. **Soniox Account**: An API key for transcription.
6. **OpenAI or Anthropic Account**: An API key for meeting summaries and Ask Fathom.
7. **Google Cloud Project** *(Optional)*: OAuth credentials for Google Calendar integration.

---

## Quickstart & Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/harilexm/Fathom-clone.git
cd Fathom-clone
```

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Open `.env.local` and populate the values:

```env
# APP
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# SUPABASE
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-or-publishable-key
SUPABASE_SECRET_KEY=your-supabase-service-role-secret-key

# CLOUDFLARE R2
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_BUCKET_NAME=your-r2-bucket-name
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key

# SONIOX (Speech-to-Text)
SONIOX_API_KEY=your-soniox-api-key
SONIOX_WEBHOOK_SECRET=your-64-char-random-hex-secret

# OPENAI (AI Summaries & Ask Fathom)
OPENAI_API_KEY=your-openai-api-key
OPENAI_CHAT_MODEL=gpt-4o
OPENAI_ANALYSIS_MODEL=gpt-4o
OPENAI_LIVE_MODEL=gpt-4o-mini

# ANTHROPIC (Alternative LLM provider)
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_CHAT_MODEL=claude-3-5-sonnet-latest
ANTHROPIC_ANALYSIS_MODEL=claude-3-5-sonnet-latest
ANTHROPIC_LIVE_MODEL=claude-3-5-haiku-latest

# GOOGLE CALENDAR (Optional)
GOOGLE_CALENDAR_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CALENDAR_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALENDAR_TOKEN_KEY=your-base64-encoded-32-byte-encryption-key
```

#### Generating Cryptographic Keys

You can generate the required encryption and webhook keys with Node.js in your terminal:

- **Generate `GOOGLE_CALENDAR_TOKEN_KEY`** (32 random bytes Base64):
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```

- **Generate `SONIOX_WEBHOOK_SECRET`** (64 random hex characters):
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

---

### 4. Supabase Database Migrations

Apply the database migrations in sequential order. You can execute each SQL file in the **Supabase Dashboard > SQL Editor** or via the Supabase CLI:

1. `supabase/migrations/20260924000000_create_profiles.sql` — User profiles and 14-day trial initialization.
2. `supabase/migrations/20260924010000_persist_onboarding.sql` — Onboarding step progress and preference persistence.
3. `supabase/migrations/20260924020000_calendar_settings.sql` — Google Calendar connection state and encrypted token storage.
4. `supabase/migrations/20260925000000_create_meetings_schema.sql` — Core meetings, recordings, transcripts, summaries, action items, highlights, and share links with RLS.
5. `supabase/migrations/20260925010000_add_soniox_transcription.sql` — Soniox job ID and transcription metadata columns.
6. `supabase/migrations/20260925020000_add_analyzing_status.sql` — Meeting processing status state machine updates.
7. `supabase/migrations/20260925030000_add_completed_status.sql` — Completed state normalization.
8. `supabase/migrations/20260925040000_add_highlights_text.sql` — Highlight snippet text and auto-highlight flags.
9. `supabase/migrations/20260925050000_add_share_links_highlight_id.sql` — Highlight-specific share link support.
10. `supabase/migrations/20260925060000_add_credit_transactions.sql` — Minute credit accounting, deduction triggers, and trial balances.

---

### 5. Supabase Authentication Setup

In your Supabase project dashboard (**Authentication > Providers**):

1. **Email Provider**: Enable Email sign-in (toggle "Confirm email" based on your preference).
2. **Anonymous Sign-ins**: Enable under **Authentication > Sign In / Up > Allow anonymous sign-ins**. This powers the instant demo guest access.
3. **Google Provider** *(Optional)*:
   - Enable Google OAuth under **Authentication > Providers > Google**.
   - Enter your Google Client ID and Secret.
4. **URL Configuration**:
   - Under **Authentication > URL Configuration > Redirect URLs**, add:
     - `http://localhost:3000/auth/callback`
     - `https://your-production-domain.com/auth/callback` (in production)

---

### 6. Cloudflare R2 CORS Configuration

To allow direct browser uploads to your R2 bucket via presigned PUT URLs, configure CORS on your R2 bucket (**Cloudflare Dashboard > R2 > your-bucket > Settings > CORS Policy**):

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-production-domain.com"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

---

### 7. Google Calendar Integration *(Optional)*

If you want to enable the calendar integration in onboarding and settings:

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Calendar API**.
3. Create an **OAuth 2.0 Web Application Client**:
   - **Authorized redirect URIs**:
     - `http://localhost:3000/onboarding/calendar/callback`
     - `https://your-production-domain.com/onboarding/calendar/callback`
4. Set `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET` in `.env.local`.
5. Ensure `GOOGLE_CALENDAR_TOKEN_KEY` is set to a base64-encoded 32-byte key (used to encrypt refresh tokens at rest with AES-256-GCM).

---

### 8. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- You can immediately test the app by clicking **Start with Demo Guest** on the landing page, or sign up with email/Google.
- New users are guided through the 5-step onboarding flow at `/onboarding`.
- After onboarding, you will land in **My Calls** (`/my-calls`).

---

## Project Structure

```
FathomClone/
├── .env.example               # Reference environment variables
├── package.json               # Dependencies and build scripts
├── tailwind.config.ts         # Tailwind design tokens and custom palette
├── scripts/
│   └── next-cli.mjs           # Next CLI runner with cross-platform SWC WASM fallback
├── supabase/
│   └── migrations/            # Ordered PostgreSQL migration files
└── src/
    ├── app/
    │   ├── page.tsx           # Public landing page (Hero glow, preview, workflow)
    │   ├── login/             # Sign-in & sign-up forms (Email, Google, Demo)
    │   ├── auth/callback/     # Supabase OAuth redirect handler
    │   ├── onboarding/        # 5-step guided setup flow & calendar consent
    │   ├── privacy/           # Public Privacy Policy
    │   ├── terms/             # Public Terms of Service
    │   ├── share/[token]/     # Public shared meeting & highlight player
    │   ├── api/               # Server-side API route handlers
    │   │   ├── meetings/      # Upload URLs, status polling, Ask Fathom Q&A
    │   │   ├── webhooks/      # Soniox transcription callback listener
    │   │   └── calendar/      # Google Calendar synchronization
    │   └── (workspace)/       # Protected workspace routes
    │       ├── layout.tsx     # Persistent workspace topnav & navigation
    │       ├── my-calls/      # Meetings list, upload modal, filter & sort
    │       ├── meeting/[id]/  # Meeting detail (Video, Transcript, AI Notes, Highlights)
    │       ├── search/        # Global full-text search with timestamp jump
    │       ├── settings/      # Account, billing credits, calendar management
    │       └── playlists/     # Meeting collections & playlists
    ├── components/            # Reusable UI components
    │   ├── fathom-logo.tsx    # Responsive SVG brand logo
    │   ├── meeting-player.tsx # Synchronized media player with highlight cropping
    │   ├── transcript.tsx     # Diarized speaker transcript with search & seek
    │   ├── ask-fathom-panel.tsx # Contextual AI assistant chat panel
    │   └── share-dialog.tsx   # Cryptographic share link generator
    └── lib/                   # Core business logic & integrations
        ├── supabase/          # Supabase client, server, admin, middleware
        ├── r2.ts              # Cloudflare R2 presigned upload/playback URLs
        ├── soniox.ts          # Speech recognition & diarization pipeline
        ├── openai.ts          # OpenAI summaries, action items, Ask Fathom
        ├── anthropic.ts       # Anthropic Claude provider adapter
        ├── media-duration.ts  # Multi-layer fallback media duration parser
        ├── credits.ts         # Minute-credit accounting & trial balances
        └── google-calendar.ts # AES-256 token encryption & calendar sync
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Next.js local development server on `http://localhost:3000`. |
| `npm run typecheck` | Runs TypeScript compiler checks without emitting files (`tsc --noEmit`). |
| `npm run lint` | Runs ESLint across all TypeScript and React components. |
| `npm run build` | Builds the production bundle. |
| `npm run start` | Runs the production Next.js server. |

> **Note for Windows Users**: The repository includes `scripts/next-cli.mjs` which automatically invokes `@next/swc-wasm-nodejs` on Windows environments where native SWC DLL initialization may fail. macOS and Linux run standard Next.js execution out of the box.

---

## Verification & Quality Assurance

To verify code quality and ensure no type or lint regressions:

```bash
# 1. Typecheck
npm run typecheck

# 2. Lint
npm run lint

# 3. Production Build
npm run build
```

---

## Security & Architecture Principles

- **Zero Client Credential Leaks**: Cloudflare R2 credentials, Supabase Service Role keys, Soniox API tokens, OpenAI keys, and encryption keys remain exclusively on the server. Browser clients only ever receive short-lived, signed URLs.
- **Row Level Security (RLS)**: Every meeting, recording, transcript segment, action item, and highlight is protected by PostgreSQL RLS policies scoped to the authenticated user ID.
- **Resilient Media Metadata**: Audio/video duration parsing features a multi-layer fallback pipeline (MP4 atom probing, transcript boundary timestamps, and client sync).
- **Idempotent Webhooks & Credit Deductions**: Soniox callbacks and credit ledger transactions are strictly idempotent; minutes are deducted only upon successful transcription and AI analysis.
- **Encrypted Tokens**: Google OAuth refresh tokens are stored encrypted at rest using AES-256-GCM.

---

## License

This project is licensed under the [MIT License](LICENSE).
