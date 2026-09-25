import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-full py-8 px-4 sm:px-6">
      <section aria-label="Privacy Policy" className="fade-in mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="border-b border-[#1e2a3a] pb-6">
          <Link
            href="/my-calls"
            className="mb-3 inline-flex items-center text-xs font-semibold text-[#8da3be] hover:text-white transition"
          >
            ← Back to Calls
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Legal &amp; Governance</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Privacy Policy</h1>
          <p className="mt-1.5 text-xs text-[#8da3be]">
            Last updated: September 25, 2026 · Workspace Privacy Practices
          </p>
        </div>

        <p className="text-xs leading-relaxed text-[#9ab0c7]">
          This document describes how data is handled within your workspace during this preview release. All user media, transcripts, and intelligence data are protected under strict access boundaries.
        </p>

        {/* Structured Sections */}
        <div className="space-y-4">
          <div className="surface rounded-2xl border border-[#223348] p-6 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 1</span>
            <h2 className="mt-1 text-sm font-bold text-white">Information Stored and Processed</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#9ab0c7]">
              Supabase securely maintains your sign-in identity, workspace profile choices, meeting metadata, speech-to-text transcripts, summary records, action items, highlights, share link configurations, and available credit balances. Uploaded audio and video media files are stored strictly within encrypted, private Cloudflare R2 bucket storage.
            </p>
          </div>

          <div className="surface rounded-2xl border border-[#223348] p-6 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 2</span>
            <h2 className="mt-1 text-sm font-bold text-white">Third-Party Processing Services</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#9ab0c7]">
              When you initiate processing on an uploaded recording, the audio stream is dispatched to Soniox for asynchronous speech-to-text transcription with speaker diarization. Meeting analysis, executive summaries, and action item detection are performed through server-side AI provider calls. Calendar connections utilize Google&apos;s read-only Calendar scope; all OAuth tokens are encrypted before storage and immediately purged upon disconnect.
            </p>
          </div>

          <div className="surface rounded-2xl border border-[#223348] p-6 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 3</span>
            <h2 className="mt-1 text-sm font-bold text-white">Access Boundaries &amp; Public Sharing</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#9ab0c7]">
              All meeting data is isolated to the authenticated workspace owner. Media playback uses temporary, short-lived presigned URLs. When you generate a share link, external access is cryptographically tokenized and strictly confined to that specific meeting or trimmed highlight clip. You may revoke active share links at any time to instantly terminate public access.
            </p>
          </div>

          <div className="surface rounded-2xl border border-[#223348] p-6 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 4</span>
            <h2 className="mt-1 text-sm font-bold text-white">Data Retention &amp; User Controls</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#9ab0c7]">
              You can disconnect third-party integrations (such as Google Calendar) and revoke shared links at any time within your workspace settings. To request full workspace data removal, contact your system administrator.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
