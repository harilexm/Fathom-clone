import Link from "next/link";

export default function PrivacyPolicyPage() {
  return <section aria-label="Privacy Policy" className="fade-in max-w-3xl">
    <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs text-muted">Fathom Clone test project · updated September 25, 2026</p><h1 className="mt-1 text-xl font-semibold text-ink">Privacy Policy</h1></div><Link href="/my-calls" className="text-xs text-brand hover:underline">Back to calls</Link></div>
    <p className="mb-4 text-xs leading-5 text-muted">This page describes the current preview implementation. A formal operator privacy notice and contact address have not been published. Do not upload sensitive recordings to this test project.</p>
    <div className="surface divide-y divide-[#253345] text-xs leading-5 text-muted">
      <section className="p-5"><h2 className="mb-2 text-sm font-semibold text-ink">Information stored</h2><p>Supabase stores your sign-in identity, profile choices, meeting records, transcripts, summaries, action items, highlights, share links, and credit balance. Uploaded media is stored in private Cloudflare R2 storage.</p></section>
      <section className="p-5"><h2 className="mb-2 text-sm font-semibold text-ink">Processing services</h2><p>When you process a recording, the app uses Soniox for transcription and OpenAI for meeting analysis. Ask Fathom may send relevant owned meeting content to the configured AI provider. Calendar connection uses Google&apos;s read-only Calendar scope; its refresh token is encrypted before server-side storage.</p></section>
      <section className="p-5"><h2 className="mb-2 text-sm font-semibold text-ink">Access and sharing</h2><p>Meeting data is scoped to your signed-in account. Recording upload and playback use short-lived signed URLs. If you explicitly create a share link, anyone holding the active link can view the shared content until you revoke it. Demo fixtures are separate from your uploads.</p></section>
      <section className="p-5"><h2 className="mb-2 text-sm font-semibold text-ink">Retention and choices</h2><p>You can disconnect Google Calendar and revoke meeting share links in the app. Self-service account and recording deletion, export, and a published retention schedule are not available in this test project. Signing out does not remove stored data.</p></section>
    </div>
  </section>;
}
