import Link from "next/link";

export default function TermsOfServicePage() {
  return <section aria-label="Terms of Service" className="fade-in max-w-3xl">
    <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs text-muted">Fathom Clone test project · updated September 25, 2026</p><h1 className="mt-1 text-xl font-semibold text-ink">Terms of Service</h1></div><Link href="/my-calls" className="text-xs text-brand hover:underline">Back to calls</Link></div>
    <p className="mb-4 text-xs leading-5 text-muted">This is a test-project service description, not a published commercial agreement. The operator identity and formal terms are still to be supplied before a public launch.</p>
    <div className="surface divide-y divide-[#253345] text-xs leading-5 text-muted">
      <section className="p-5"><h2 className="mb-2 text-sm font-semibold text-ink">Use of the preview</h2><p>Use recordings you are allowed to upload and share. AI transcripts, summaries, and action items can be inaccurate; review them before relying on them. Avoid uploading sensitive or confidential material to this test project.</p></section>
      <section className="p-5"><h2 className="mb-2 text-sm font-semibold text-ink">Accounts and sharing</h2><p>Your account controls access to your private meeting library. An active share link is accessible to anyone with its URL until revoked. Demo guest sessions are anonymous and may be inaccessible after sign-out.</p></section>
      <section className="p-5"><h2 className="mb-2 text-sm font-semibold text-ink">Trial, credits, and billing</h2><p>New accounts have a 14-day Pro trial, including Demo guests. Processing uses one credit per started minute after successful media processing. Pro and Max paid plans are planned, but checkout and automatic billing are not connected. This preview does not charge a payment method at trial expiry.</p></section>
      <section className="p-5"><h2 className="mb-2 text-sm font-semibold text-ink">Availability</h2><p>Features and stored data may change while the test project is developed. Self-service account deletion and data export are not yet implemented. Formal commercial terms, support channels, and service commitments will need publication before launch.</p></section>
    </div>
  </section>;
}
