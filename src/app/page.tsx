import Link from "next/link";
import { FathomLogo } from "@/components/fathom-logo";
import {
  ArrowRight,
  Sparkles,
  Shield,
  Clock,
  CheckCircle2,
  FileText,
  Search,
  Bot,
  Play,
  Share2,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#06080d] text-[#f1f5f9] flex flex-col selection:bg-[#2563eb]/30 selection:text-[#93c5fd]">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_45%_at_50%_-10%,#0d1624_0%,#06080d_70%)] opacity-80" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-[#131b26] bg-[#06080d]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <FathomLogo href="/" size="sm" />
            <nav className="hidden md:flex items-center gap-5 text-xs text-muted">
              <a href="#features" className="hover:text-[#f1f5f9] transition">Features</a>
              <a href="#workspace" className="hover:text-[#f1f5f9] transition">Product</a>
              <a href="#security" className="hover:text-[#f1f5f9] transition">Security</a>
              <Link href="/privacy" className="hover:text-[#f1f5f9] transition">Privacy</Link>
              <Link href="/terms" className="hover:text-[#f1f5f9] transition">Terms</Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/my-calls"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-hover shadow-sm"
              >
                Go to My Calls <ArrowRight size={13} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg border border-[#151e2b] bg-[#080c14] px-3.5 py-1.5 text-xs font-semibold text-[#cbd5e1] hover:border-[#1e2a3c] hover:text-[#f1f5f9] transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-hover shadow-sm"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1">
        <section className="mx-auto max-w-5xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28 text-center space-y-6">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1d3557] bg-[#0c182b] px-3 py-1 text-xs font-medium text-[#60a5fa]">
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            <span>AI Meeting Intelligence · Never take notes again</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl font-extrabold tracking-tight text-[#f1f5f9] sm:text-6xl sm:leading-[1.15]">
            Focus on the conversation,<br className="hidden sm:inline" />
            <span className="text-[#60a5fa]"> not the notes.</span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto max-w-2xl text-sm sm:text-base leading-relaxed text-[#cbd5e1]">
            A high-contrast, distraction-free meeting intelligence workspace. Upload recordings or connect Google Calendar for speaker-diarized transcripts, executive notes, and instant contextual search.
          </p>

          {/* CTA Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand/20 transition hover:bg-brand-hover"
            >
              Start Free with Demo Guest <ArrowRight size={15} />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-[#151e2b] bg-[#080c14] px-5 py-3 text-sm font-semibold text-[#cbd5e1] hover:border-[#1e2a3c] hover:bg-[#0d131d] hover:text-[#f1f5f9] transition"
            >
              Sign In with Google
            </Link>
          </div>

          {/* Trust points */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#34d399]" /> No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#34d399]" /> 50 starter minutes included
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#34d399]" /> Encrypted private R2 storage
            </span>
          </div>

          {/* Workspace Product Mockup */}
          <div id="workspace" className="pt-12">
            <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-3 sm:p-5 shadow-2xl">
              {/* Fake Workspace Window Header */}
              <div className="flex items-center justify-between border-b border-[#131b26] pb-3 mb-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1e2a3a]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1e2a3a]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1e2a3a]" />
                  <span className="ml-2 font-semibold text-[#f1f5f9] hidden sm:inline">
                    Q3 Product Roadmap Review · 18:24
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted">
                  <span className="rounded bg-[#0c182b] border border-[#1d3557] px-2 py-0.5 text-[10px] font-bold text-[#60a5fa] uppercase">
                    Processed
                  </span>
                  <span className="hidden sm:inline">4 participants</span>
                </div>
              </div>

              {/* Grid: Player Preview & Intelligence Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-left">
                {/* Left: Player Mockup */}
                <div className="lg:col-span-7 rounded-lg border border-[#131b26] bg-[#06080d] p-4 flex flex-col justify-between min-h-[260px]">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="font-semibold text-[#f1f5f9]">Speaker: Danny Shavit</span>
                    <span className="font-mono text-[11px]">04:12 / 18:24</span>
                  </div>

                  <div className="my-auto flex flex-col items-center justify-center py-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0c182b] border border-[#1d3557] text-[#60a5fa]">
                      <Play size={22} className="ml-0.5" />
                    </div>
                    <p className="mt-3 text-xs text-[#cbd5e1] font-medium">Click to seek exact moment</p>
                  </div>

                  {/* Waveform track */}
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full rounded-full bg-[#151e2b] overflow-hidden">
                      <div className="h-full w-1/3 bg-brand rounded-full" />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted font-mono">
                      <span>00:00</span>
                      <span>18:24</span>
                    </div>
                  </div>
                </div>

                {/* Right: Notes & Ask Fathom Mockup */}
                <div className="lg:col-span-5 rounded-lg border border-[#131b26] bg-[#080c14] p-4 space-y-4">
                  {/* Tabs */}
                  <div className="flex items-center gap-2 border-b border-[#131b26] pb-2 text-[11px] font-semibold">
                    <span className="text-brand border-b border-brand pb-2">Summary</span>
                    <span className="text-muted pb-2">Action Items (3)</span>
                    <span className="text-muted pb-2">Highlights (2)</span>
                  </div>

                  {/* Summary Snippet */}
                  <div className="space-y-1.5 text-xs">
                    <h4 className="font-semibold text-[#f1f5f9]">Key Discussion Takeaways</h4>
                    <p className="text-[#cbd5e1] leading-relaxed text-[11.5px]">
                      The team confirmed final timelines for the automated speech diarization pipeline. Cloudflare R2 signed playback verified under 200ms latency.
                    </p>
                  </div>

                  {/* Ask Fathom Query Box */}
                  <div className="rounded-md border border-[#151e2b] bg-[#070a10] p-2.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                      <Bot size={11} /> Ask Fathom
                    </div>
                    <p className="text-[11px] text-[#f1f5f9] font-medium">
                      &ldquo;What were the agreed next steps for Danny?&rdquo;
                    </p>
                    <p className="text-[11px] text-[#94a3b8] leading-normal border-t border-[#131b26] pt-1.5">
                      Danny will ship the highlight trim player and verify signed token URL expiry by end of week.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="border-t border-[#131b26] bg-[#070a10]/50 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="text-center space-y-2 mb-12">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Capabilities</span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f1f5f9]">
                Engineered for Executive Productivity
              </h2>
              <p className="text-xs sm:text-sm text-muted max-w-lg mx-auto">
                No bloated features or AI hallucination slop. Clean, reliable intelligence for every meeting you record.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {/* Feature 1 */}
              <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0c182b] text-brand border border-[#1d3557]">
                  <FileText size={18} />
                </div>
                <h3 className="text-sm font-bold text-[#f1f5f9]">Diarized Speech Transcripts</h3>
                <p className="text-xs leading-relaxed text-[#cbd5e1]">
                  High-accuracy speech-to-text with automatic speaker separation. Click any transcript phrase to jump video playback directly to that timestamp.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0c182b] text-brand border border-[#1d3557]">
                  <Sparkles size={18} />
                </div>
                <h3 className="text-sm font-bold text-[#f1f5f9]">Structured Notes &amp; Actions</h3>
                <p className="text-xs leading-relaxed text-[#cbd5e1]">
                  Executive summaries, bulleted discussion overviews, auto highlights, and assigned action item lists generated automatically after processing completes.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0c182b] text-brand border border-[#1d3557]">
                  <Search size={18} />
                </div>
                <h3 className="text-sm font-bold text-[#f1f5f9]">Global Library Search</h3>
                <p className="text-xs leading-relaxed text-[#cbd5e1]">
                  Search across titles, participants, transcripts, and notes. Ask Fathom cross-examines multiple calls to surface answers with linked citations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Governance Section */}
        <section id="security" className="border-t border-[#131b26] py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-8 sm:p-10">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                <div className="md:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-1.5 rounded-md border border-[#1d3557] bg-[#0c182b] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#60a5fa]">
                    <Shield size={11} /> Enterprise-Grade Trust
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f1f5f9]">
                    Strict Data Privacy by Default
                  </h3>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#cbd5e1]">
                    Recordings are stored in private Cloudflare R2 bucket storage with time-limited signed URL playback. Database access is protected by Supabase Row-Level Security. Unshared meetings remain strictly inaccessible to anyone outside your authenticated workspace.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold pt-2">
                    <Link href="/privacy" className="text-brand hover:underline">
                      Read Privacy Policy →
                    </Link>
                    <Link href="/terms" className="text-muted hover:text-[#f1f5f9]">
                      View Terms of Service →
                    </Link>
                  </div>
                </div>

                <div className="md:col-span-5 grid grid-cols-1 gap-3 text-xs">
                  <div className="rounded-lg border border-[#151e2b] bg-[#080c14] p-3.5 space-y-1">
                    <span className="font-semibold text-[#f1f5f9] flex items-center gap-1.5">
                      <Lock size={13} className="text-brand" /> Private R2 Storage
                    </span>
                    <p className="text-muted text-[11px]">No public media URLs. Scoped signed tokens only.</p>
                  </div>
                  <div className="rounded-lg border border-[#151e2b] bg-[#080c14] p-3.5 space-y-1">
                    <span className="font-semibold text-[#f1f5f9] flex items-center gap-1.5">
                      <Share2 size={13} className="text-brand" /> Revocable Public Links
                    </span>
                    <p className="text-muted text-[11px]">Share full calls or trimmed 17s highlight clips safely.</p>
                  </div>
                  <div className="rounded-lg border border-[#151e2b] bg-[#080c14] p-3.5 space-y-1">
                    <span className="font-semibold text-[#f1f5f9] flex items-center gap-1.5">
                      <Clock size={13} className="text-brand" /> Zero Waste Credits
                    </span>
                    <p className="text-muted text-[11px]">Credits deduct only after successful media processing.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="border-t border-[#131b26] bg-[#05070c] py-14 text-center">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-4">
            <h3 className="text-2xl font-bold tracking-tight text-[#f1f5f9]">
              Ready to automate your meeting notes?
            </h3>
            <p className="text-xs sm:text-sm text-muted max-w-md mx-auto">
              Get started in seconds with a private Demo Guest session. No setup required.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-hover shadow-sm"
              >
                Launch Fathom Workspace <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Public Footer */}
      <footer className="border-t border-[#131b26] py-10 text-xs text-muted">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FathomLogo href="/" size="sm" />
            <span>· Private, secure meeting intelligence.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-[#f1f5f9] transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#f1f5f9] transition">Terms of Service</Link>
            <Link href="/login" className="hover:text-[#f1f5f9] transition">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
