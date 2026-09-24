import Link from "next/link";

export default function PrivacyPolicyPage() {
  return <section aria-label="Privacy Policy" className="fade-in max-w-3xl">
    <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs text-muted">Preview information</p><h1 className="mt-1 text-xl font-semibold text-ink">Privacy Policy</h1></div><Link href="/my-calls" className="text-xs text-brand hover:underline">Back to calls</Link></div>
    <div className="surface p-5 text-sm leading-6 text-muted">A formal privacy policy has not been published for this preview.</div>
  </section>;
}
