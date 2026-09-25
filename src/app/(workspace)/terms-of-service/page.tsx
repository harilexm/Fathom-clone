import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-full py-8 px-4 sm:px-6">
      <section aria-label="Terms of Service" className="fade-in mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="border-b border-[#1e2a3a] pb-6">
          <Link
            href="/my-calls"
            className="mb-3 inline-flex items-center text-xs font-semibold text-[#8da3be] hover:text-white transition"
          >
            ← Back to Calls
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Legal &amp; Governance</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Terms of Service</h1>
          <p className="mt-1.5 text-xs text-[#8da3be]">
            Last updated: September 25, 2026 · Workspace Usage Guidelines
          </p>
        </div>

        <p className="text-xs leading-relaxed text-[#9ab0c7]">
          These terms govern the use of the meeting intelligence workspace, upload tools, and automated analysis features during the active preview period.
        </p>

        {/* Structured Sections */}
        <div className="space-y-4">
          <div className="surface rounded-2xl border border-[#223348] p-6 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 1</span>
            <h2 className="mt-1 text-sm font-bold text-white">Authorized Use &amp; Recording Ownership</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#9ab0c7]">
              Users are responsible for ensuring they possess all necessary rights, consents, and legal authorization to record, upload, and process any uploaded audio or video material. Automated transcripts and summaries are provided as computational meeting aids; users are encouraged to verify important facts before relying on them for critical legal or financial decisions.
            </p>
          </div>

          <div className="surface rounded-2xl border border-[#223348] p-6 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 2</span>
            <h2 className="mt-1 text-sm font-bold text-white">Accounts, Sharing &amp; Access Controls</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#9ab0c7]">
              Each authenticated account maintains exclusive ownership over its private library. Generating a share link creates a public viewing portal accessible to anyone in possession of that link until explicitly revoked. Anonymous Demo Guest accounts are provided for immediate evaluation; to protect your data, convert to a permanent email account.
            </p>
          </div>

          <div className="surface rounded-2xl border border-[#223348] p-6 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 3</span>
            <h2 className="mt-1 text-sm font-bold text-white">Trial Periods, Credits &amp; Billing Terms</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#9ab0c7]">
              New workspaces begin with a 14-day Pro trial and 50 complimentary credits. Processing costs one credit per started minute of recording duration. Failed processing operations consume zero credits. Top-ups and automated recurring billing are not charged automatically during this preview.
            </p>
          </div>

          <div className="surface rounded-2xl border border-[#223348] p-6 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Section 4</span>
            <h2 className="mt-1 text-sm font-bold text-white">Service Modifications &amp; Availability</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#9ab0c7]">
              We continually iterate on analysis models and processing pipelines. While we strive for high uptime and durability, preview features are provided on an as-available basis.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
