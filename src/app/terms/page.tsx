import Link from "next/link";
import { FathomLogo } from "@/components/fathom-logo";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PublicTermsPage() {
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
              href="/privacy"
              className="text-xs text-muted hover:text-[#f1f5f9] transition hidden sm:inline-block"
            >
              Privacy Policy
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
              <FileText size={11} /> Legal &amp; Governance
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#f1f5f9] sm:text-3xl">
              Terms of Service
            </h1>
            <p className="mt-1.5 text-xs text-muted">
              Last updated: September 25, 2026 · Public Workspace Usage Guidelines
            </p>
          </div>

          <p className="text-xs sm:text-sm leading-relaxed text-[#cbd5e1]">
            These terms govern the use of the meeting intelligence workspace, upload tools, and automated analysis features across the Fathom clone platform during the active preview period.
          </p>

          {/* Structured Sections */}
          <div className="space-y-4">
            <section className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 1</span>
              <h2 className="mt-1 text-sm font-bold text-[#f1f5f9]">Authorized Use &amp; Recording Ownership</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
                Users are responsible for ensuring they possess all necessary rights, consents, and legal authorization to record, upload, and process any uploaded audio or video material. Automated transcripts and summaries are provided as computational meeting aids; users are encouraged to verify important facts before relying on them for critical legal or financial decisions.
              </p>
            </section>

            <section className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 2</span>
              <h2 className="mt-1 text-sm font-bold text-[#f1f5f9]">Accounts, Sharing &amp; Access Controls</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
                Each authenticated account maintains exclusive ownership over its private library. Generating a share link creates a public viewing portal accessible to anyone in possession of that link until explicitly revoked. Anonymous Demo Guest accounts are provided for immediate evaluation; to protect your data, convert to a permanent email account.
              </p>
            </section>

            <section className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 3</span>
              <h2 className="mt-1 text-sm font-bold text-[#f1f5f9]">Trial Periods, Credits &amp; Billing Terms</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
                New workspaces begin with a 14-day Pro trial and 50 complimentary credits. Processing costs one credit per started minute of recording duration. Failed processing operations consume zero credits. Top-ups and automated recurring billing are not charged automatically during this preview.
              </p>
            </section>

            <section className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 4</span>
              <h2 className="mt-1 text-sm font-bold text-[#f1f5f9]">Service Modifications &amp; Availability</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
                We continually iterate on analysis models and processing pipelines. While we strive for high uptime and durability, preview features are provided on an as-available basis.
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
            <Link href="/privacy" className="hover:text-[#f1f5f9] transition">Privacy Policy</Link>
            <Link href="/login" className="hover:text-[#f1f5f9] transition">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
