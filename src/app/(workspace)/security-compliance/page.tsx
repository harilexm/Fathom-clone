import Link from "next/link";

export default function SecurityCompliancePage() {
  return <section aria-label="Security & Compliance" className="fade-in max-w-3xl">
    <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs text-muted">Fathom Clone test project · updated September 25, 2026</p><h1 className="mt-1 text-xl font-semibold text-ink">Security &amp; Compliance</h1></div><Link href="/my-calls" className="text-xs text-brand hover:underline">Back to calls</Link></div>
    <p className="mb-4 text-xs leading-5 text-muted">Current implementation details are listed below. No external security audit, certification, or regulatory compliance claim is made for this preview.</p>
    <div className="surface divide-y divide-[#253345] text-xs leading-5 text-muted">
      <section className="p-5"><h2 className="mb-2 text-sm font-semibold text-ink">Account and data access</h2><p>Supabase Auth verifies workspace sessions. Meeting records use ownership checks and Supabase row-level security. Public share links use unique tokens and can be revoked.</p></section>
      <section className="p-5"><h2 className="mb-2 text-sm font-semibold text-ink">Media and credentials</h2><p>Cloudflare R2 media is private; uploads and playback use scoped signed URLs. Provider API credentials stay on the server. Google Calendar refresh tokens are encrypted before storage and are removed when Calendar is disconnected.</p></section>
      <section className="p-5"><h2 className="mb-2 text-sm font-semibold text-ink">Processing and limitations</h2><p>Recordings are sent to configured transcription and AI providers for requested processing. This test project has no published retention schedule, self-service deletion flow, compliance attestation, or incident-response commitment. Avoid regulated or sensitive material until those are established.</p></section>
    </div>
  </section>;
}
