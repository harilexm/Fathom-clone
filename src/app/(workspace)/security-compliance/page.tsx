import Link from "next/link";

export default function SecurityCompliancePage() {
  return (
    <div className="min-h-full py-8 px-4 sm:px-6">
      <section aria-label="Security and Compliance" className="fade-in mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="border-b border-[#131b26] pb-6">
          <Link
            href="/my-calls"
            className="mb-3 inline-flex items-center text-xs font-semibold text-muted hover:text-[#f1f5f9] transition"
          >
            ← Back to Calls
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Architecture &amp; Trust</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f1f5f9] sm:text-3xl">
            Security &amp; Compliance
          </h1>
          <p className="mt-1.5 text-xs text-muted">
            Technical safeguards, architectural isolation, and data protection practices.
          </p>
        </div>

        <p className="text-xs leading-relaxed text-[#cbd5e1]">
          The platform enforces multi-layered technical security across media storage, database access, third-party AI processing, and public sharing.
        </p>

        {/* Structured Sections */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Safeguard 1</span>
            <h2 className="mt-1 text-sm font-bold text-[#f1f5f9]">Database Row-Level Security &amp; Ownership</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
              Supabase Authentication strictly scopes user sessions. Postgres Row-Level Security (RLS) policies enforce that queries on meetings, recordings, transcripts, summaries, action items, and highlights only return data belonging to the authenticated workspace owner.
            </p>
          </div>

          <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Safeguard 2</span>
            <h2 className="mt-1 text-sm font-bold text-[#f1f5f9]">Private Storage &amp; Scoped Media Playback</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
              All audio and video assets are kept in private, non-public Cloudflare R2 bucket storage. Uploads and playback streams utilize time-limited cryptographically signed URLs generated exclusively on the server. Browser clients never receive root cloud storage credentials.
            </p>
          </div>

          <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Safeguard 3</span>
            <h2 className="mt-1 text-sm font-bold text-[#f1f5f9]">Encrypted OAuth &amp; Server-Side Privileges</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
              Google Calendar integration requests the minimal read-only calendar scope. All OAuth refresh tokens are encrypted using AES-256 before storage in the database. Disconnecting Google Calendar immediately purges stored keys. Privileged calls to Soniox, OpenAI, and Anthropic are executed exclusively on backend servers.
            </p>
          </div>

          <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand">Safeguard 4</span>
            <h2 className="mt-1 text-sm font-bold text-[#f1f5f9]">Cryptographic Share Tokenization</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#cbd5e1]">
              Public sharing utilizes high-entropy, random cryptographic tokens. Highlight sharing is strictly isolated to the specific clip duration, preventing unauthorized access to the full recording. Revoking a share link immediately blocks all future public requests.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
