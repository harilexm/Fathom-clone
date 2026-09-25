import Link from "next/link";
import { FathomLogo } from "@/components/fathom-logo";
import { ArrowLeft, Shield, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PublicPrivacyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#06080d] text-[#f1f5f9] flex flex-col">
      {/* Public Header */}
      <header className="sticky top-0 z-30 border-b border-[#131b26] bg-[#06080d]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <FathomLogo href="/" size="sm" />
            <span className="hidden sm:inline-block h-4 w-px bg-[#151e2b]" />
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted hover:text-[#f1f5f9] transition"
            >
              <ArrowLeft size={13} /> Back to Home
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/terms"
              className="text-xs text-muted hover:text-[#f1f5f9] transition hidden sm:inline-block"
            >
              Terms of Service
            </Link>
            {user ? (
              <Link
                href="/my-calls"
                className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-hover shadow-sm"
              >
                Go to My Calls →
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-lg border border-[#151e2b] bg-[#080c14] px-3.5 py-1.5 text-xs font-semibold text-[#cbd5e1] hover:border-[#1e2a3c] hover:text-[#f1f5f9] transition"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-10 px-4 sm:px-6">
        <article className="mx-auto max-w-3xl space-y-8">
          {/* Page Title & Meta */}
          <div className="border-b border-[#131b26] pb-6">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-[#1d3557] bg-[#0c182b] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#60a5fa] mb-3">
              <Shield size={11} /> Legal &amp; Governance
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#f1f5f9] sm:text-3xl">
              Privacy Policy
            </h1>
            <p className="mt-1.5 text-xs text-muted">
              Last updated: September 25, 2026 · Public Workspace Privacy Practices
            </p>
          </div>

          <p className="text-xs sm:text-sm leading-relaxed text-[#cbd5e1]">
            This policy outlines how personal information, meeting recordings, audio streams, speech-to-text transcripts, and AI-derived intelligence are handled across the Fathom clone platform. We believe meeting data is inherently confidential and enforce strict isolation across every layer of the architecture.
          </p>

          {/* Structured Sections */}
          <div className="space-y-4">
            <section className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 1</span>
              <h2 className="mt-1 text-sm font-bold text-[#f1f5f9]">Information Stored and Processed</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
                Supabase securely maintains your sign-in identity, workspace profile choices, meeting metadata, speech-to-text transcripts, summary records, action items, highlights, share link configurations, and available credit balances. Uploaded audio and video media files are stored strictly within encrypted, private Cloudflare R2 bucket storage.
              </p>
            </section>

            <section className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 2</span>
              <h2 className="mt-1 text-sm font-bold text-[#f1f5f9]">Third-Party Processing Services</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
                When you initiate processing on an uploaded recording, the audio stream is dispatched to Soniox for asynchronous speech-to-text transcription with speaker diarization. Meeting analysis, executive summaries, and action item detection are performed through server-side AI provider calls. Calendar connections utilize Google&apos;s read-only Calendar scope; all OAuth tokens are encrypted before storage and immediately purged upon disconnect.
              </p>
            </section>

            <section className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 3</span>
              <h2 className="mt-1 text-sm font-bold text-[#f1f5f9]">Access Boundaries &amp; Public Sharing</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
                All meeting data is isolated to the authenticated workspace owner. Media playback uses temporary, short-lived presigned URLs. When you generate a share link, external access is cryptographically tokenized and strictly confined to that specific meeting or trimmed highlight clip. You may revoke active share links at any time to instantly terminate public access.
              </p>
            </section>

            <section className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 4</span>
              <h2 className="mt-1 text-sm font-bold text-[#f1f5f9]">Data Retention &amp; User Controls</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
                You can disconnect third-party integrations (such as Google Calendar) and revoke shared links at any time within your workspace settings. To request full workspace data removal, contact your system administrator.
              </p>
            </section>
          </div>
        </article>
      </main>

      {/* Public Footer */}
      <footer className="border-t border-[#131b26] py-8 text-center text-xs text-muted">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6">
          <p>© 2026 Fathom Clone. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-[#f1f5f9] transition">Home</Link>
            <Link href="/terms" className="hover:text-[#f1f5f9] transition">Terms of Service</Link>
            <Link href="/login" className="hover:text-[#f1f5f9] transition">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
