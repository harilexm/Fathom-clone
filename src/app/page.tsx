import Link from "next/link";
import { FathomLogo } from "@/components/fathom-logo";
import { ArrowRight, Check, Play, Search, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#06080d] text-[#f1f5f9] flex flex-col antialiased">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-[#131b26] bg-[#06080d]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <FathomLogo href="/" size="sm" />
            <nav className="hidden md:flex items-center gap-6 text-xs text-[#8da3be]">
              <a href="#how-it-works" className="hover:text-[#f1f5f9] transition">Workflow</a>
              <a href="#features" className="hover:text-[#f1f5f9] transition">Capabilities</a>
              <a href="#security" className="hover:text-[#f1f5f9] transition">Security</a>
              <Link href="/privacy" className="hover:text-[#f1f5f9] transition">Privacy</Link>
              <Link href="/terms" className="hover:text-[#f1f5f9] transition">Terms</Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/my-calls"
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-hover shadow-sm"
              >
                Go to My Calls <ArrowRight size={13} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-md border border-[#151e2b] bg-[#080c14] px-3.5 py-1.5 text-xs font-medium text-[#cbd5e1] hover:border-[#1e2a3c] hover:text-[#f1f5f9] transition"
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="rounded-md bg-brand px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-hover shadow-sm"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto max-w-4xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#60a5fa] mb-4">
            Meeting Intelligence Platform
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#f1f5f9] sm:text-5xl sm:leading-[1.18]">
            Automated meeting notes and transcripts,<br className="hidden sm:inline" />
            built for productive teams.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-[#94a3b8] sm:text-base">
            Fathom transcribes your recordings with speaker diarization, generates concise executive notes and action items, and lets you query your call history with contextual search.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-brand px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-hover shadow-sm"
            >
              Start with Demo Guest <ArrowRight size={13} />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md border border-[#151e2b] bg-[#080c14] px-5 py-2.5 text-xs font-semibold text-[#cbd5e1] hover:border-[#1e2a3c] hover:bg-[#0d131d] hover:text-[#f1f5f9] transition"
            >
              Sign in with Email or Google
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#64748b]">
            <span className="flex items-center gap-1.5">
              <Check size={13} className="text-[#34d399]" /> 50 minutes included
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={13} className="text-[#34d399]" /> No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={13} className="text-[#34d399]" /> Private encrypted storage
            </span>
          </div>
        </section>

        {/* Product Workspace Preview */}
        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <div className="rounded-xl border border-[#131b26] bg-[#070a10] shadow-2xl overflow-hidden">
            {/* Window title bar */}
            <div className="flex items-center justify-between border-b border-[#131b26] bg-[#05070c] px-4 py-3 text-xs text-[#64748b]">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-[#f1f5f9]">My Calls</span>
                <span>/</span>
                <span className="text-[#cbd5e1]">Weekly Sprint &amp; Architecture Sync</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-[#cbd5e1]">Processed · 24 min</span>
              </div>
            </div>

            {/* Split Interface Mock */}
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#131b26]">
              {/* Left Column: Player & Transcript Preview */}
              <div className="lg:col-span-7 p-5 space-y-4">
                <div className="rounded-lg border border-[#131b26] bg-[#06080d] p-4">
                  <div className="flex items-center justify-between text-xs text-[#64748b] mb-3">
                    <span className="font-semibold text-[#f1f5f9]">Speaker: Danny Shavit</span>
                    <span className="font-mono text-[11px]">04:12 / 24:18</span>
                  </div>
                  <div className="aspect-video w-full rounded bg-[#030508] border border-[#0e141f] flex flex-col items-center justify-center text-center p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0c182b] border border-[#1d3557] text-[#60a5fa]">
                      <Play size={16} className="ml-0.5" />
                    </div>
                    <p className="mt-2 text-[11px] text-[#64748b]">Click timestamp to jump to audio moment</p>
                  </div>
                </div>

                {/* Transcript Segment Preview */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="rounded bg-[#0c182b] border border-[#1d3557] px-1.5 py-0.5 font-mono text-[10px] text-[#60a5fa]">04:12</span>
                    <div>
                      <span className="font-semibold text-[#f1f5f9]">Danny Shavit:</span>
                      <p className="text-[#94a3b8] mt-0.5 leading-relaxed">
                        We reviewed the audio processing benchmark. Soniox diarization output is returning under 45 seconds for a 20-minute call.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="rounded bg-[#0c182b] border border-[#1d3557] px-1.5 py-0.5 font-mono text-[10px] text-[#60a5fa]">04:48</span>
                    <div>
                      <span className="font-semibold text-[#f1f5f9]">Umer Abdullah:</span>
                      <p className="text-[#94a3b8] mt-0.5 leading-relaxed">
                        Agreed. Let&apos;s finalize the signed URL playback logic so shared links remain time-scoped and cryptographically safe.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Structured Notes Preview */}
              <div className="lg:col-span-5 p-5 space-y-5 bg-[#070a10]">
                {/* Notes tab row */}
                <div className="flex items-center gap-4 border-b border-[#131b26] pb-2 text-xs font-semibold">
                  <span className="text-brand border-b border-brand pb-2">Summary</span>
                  <span className="text-[#64748b] pb-2">Action Items (3)</span>
                  <span className="text-[#64748b] pb-2">Highlights (2)</span>
                </div>

                {/* Executive Summary */}
                <div className="space-y-1.5 text-xs">
                  <h4 className="font-semibold text-[#f1f5f9]">Executive Summary</h4>
                  <p className="text-[#94a3b8] leading-relaxed text-[11.5px]">
                    The team aligned on the speech pipeline deployment. Diarization latency is verified, and signed share URLs are scoped strictly to the authenticated meeting owner.
                  </p>
                </div>

                {/* Action Items */}
                <div className="space-y-2 text-xs border-t border-[#131b26] pt-4">
                  <h4 className="font-semibold text-[#f1f5f9]">Action Items</h4>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[11.5px] text-[#cbd5e1]">
                      <span className="h-3.5 w-3.5 rounded border border-[#25394f] bg-[#080c14] flex items-center justify-center text-[9px] text-[#34d399]">✓</span>
                      <span>Validate Cloudflare R2 presigned download latency</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11.5px] text-[#cbd5e1]">
                      <span className="h-3.5 w-3.5 rounded border border-[#25394f] bg-[#080c14]" />
                      <span>Implement 17-second highlight clip bounded player</span>
                    </div>
                  </div>
                </div>

                {/* Ask Fathom Query Box */}
                <div className="rounded-lg border border-[#151e2b] bg-[#080c14] p-3 text-xs space-y-1.5">
                  <span className="font-semibold text-[#f1f5f9] block">Ask Fathom</span>
                  <p className="text-[11px] text-[#60a5fa]">
                    &ldquo;What was the decision on share link security?&rdquo;
                  </p>
                  <p className="text-[11px] text-[#94a3b8] leading-relaxed border-t border-[#131b26] pt-1.5">
                    Share links use high-entropy random tokens that can be revoked immediately in Settings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works (Workflow) */}
        <section id="how-it-works" className="border-t border-[#131b26] py-16 sm:py-20 bg-[#05070c]">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mb-10 text-center space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#60a5fa]">Workflow</p>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f1f5f9]">
                How Fathom works
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-3 text-left">
              <div className="rounded-lg border border-[#131b26] bg-[#070a10] p-5 space-y-2">
                <span className="font-mono text-xs font-bold text-brand">01</span>
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Upload or Connect</h3>
                <p className="text-xs leading-relaxed text-[#94a3b8]">
                  Upload video or audio recordings (MP4, MP3, M4A, WebM) directly, or connect your Google Calendar to synchronize scheduled calls.
                </p>
              </div>

              <div className="rounded-lg border border-[#131b26] bg-[#070a10] p-5 space-y-2">
                <span className="font-mono text-xs font-bold text-brand">02</span>
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Process &amp; Transcribe</h3>
                <p className="text-xs leading-relaxed text-[#94a3b8]">
                  Soniox speech recognition transcribes the conversation with speaker identification. AI models extract summaries, key topics, and action items.
                </p>
              </div>

              <div className="rounded-lg border border-[#131b26] bg-[#070a10] p-5 space-y-2">
                <span className="font-mono text-xs font-bold text-brand">03</span>
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Search &amp; Share</h3>
                <p className="text-xs leading-relaxed text-[#94a3b8]">
                  Find exact spoken phrases with keyword jumping, query your library using Ask Fathom, or generate secure share links for highlights.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Section */}
        <section id="features" className="border-t border-[#131b26] py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mb-10 text-center space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#60a5fa]">Capabilities</p>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f1f5f9]">
                Core functionality
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-lg border border-[#131b26] bg-[#070a10] p-6 space-y-2">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Accurate Speaker Diarization</h3>
                <p className="text-xs leading-relaxed text-[#94a3b8]">
                  Every spoken turn is mapped to individual participants with exact timestamps. Clicking any line in the transcript seeks playback directly to that millisecond.
                </p>
              </div>

              <div className="rounded-lg border border-[#131b26] bg-[#070a10] p-6 space-y-2">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Executive Summaries &amp; Action Items</h3>
                <p className="text-xs leading-relaxed text-[#94a3b8]">
                  Get high-level overviews, granular discussion points, and assigned to-do items extracted automatically without having to take manual notes.
                </p>
              </div>

              <div className="rounded-lg border border-[#131b26] bg-[#070a10] p-6 space-y-2">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Global Transcript &amp; Meeting Search</h3>
                <p className="text-xs leading-relaxed text-[#94a3b8]">
                  Search across your entire meeting history by speaker name, keyword, or action item. Instant highlights direct you to exact spoken moments.
                </p>
              </div>

              <div className="rounded-lg border border-[#131b26] bg-[#070a10] p-6 space-y-2">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Trimmed Highlight Sharing</h3>
                <p className="text-xs leading-relaxed text-[#94a3b8]">
                  Create and share short video clips (e.g. 17 seconds) with external colleagues. Viewers only see the shared excerpt without accessing full recordings.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Data Governance */}
        <section id="security" className="border-t border-[#131b26] py-16 sm:py-20 bg-[#05070c]">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 sm:p-8">
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-[#60a5fa]" />
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#60a5fa]">Security &amp; Privacy</p>
                </div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#f1f5f9]">
                  Strict data isolation and access controls
                </h2>
                <p className="text-xs leading-relaxed text-[#94a3b8]">
                  All media is stored in private Cloudflare R2 buckets using signed time-limited URLs. Data access is enforced through Supabase Row-Level Security, ensuring that unshared meetings are completely private to your account.
                </p>
                <div className="pt-2 flex items-center gap-4 text-xs">
                  <Link href="/privacy" className="font-medium text-brand hover:underline">
                    Privacy Policy →
                  </Link>
                  <Link href="/terms" className="font-medium text-[#8da3be] hover:text-[#f1f5f9]">
                    Terms of Service →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA Block */}
        <section className="border-t border-[#131b26] py-16 text-center">
          <div className="mx-auto max-w-xl px-4 sm:px-6 space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f1f5f9]">
              Start using Fathom
            </h2>
            <p className="text-xs text-[#94a3b8]">
              Test all features instantly with a private Demo Guest session. 50 complimentary minutes included.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-hover shadow-sm"
              >
                Launch Workspace <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#131b26] py-8 text-xs text-[#64748b]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FathomLogo href="/" size="sm" />
            <span>· Meeting intelligence workspace</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-[#f1f5f9] transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#f1f5f9] transition">Terms of Service</Link>
            <Link href="/login" className="hover:text-[#f1f5f9] transition">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
