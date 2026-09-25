import Link from "next/link";

const questions = [
  { question: "How can I sign in?", answer: "Use email and password, Google, or Demo guest on the sign-in page. A Demo guest is an anonymous Supabase account; signing out may make that account inaccessible." },
  { question: "How do I add a meeting?", answer: "Upload an audio or video recording from My Calls. Processing requires enough credits, and your recording may take time to transcribe and analyze." },
  { question: "When are credits used?", answer: "New accounts start with 50 credits. Processing costs one credit per started minute. Credits are deducted only after successful processing; failed processing uses zero credits. Ask Fathom text questions use zero credits. Top-ups are not available yet." },
  { question: "Can I connect Google Calendar?", answer: "Yes, if Calendar integration is configured. Open Settings to connect, reconnect, or disconnect read-only Google Calendar access. Connecting Calendar does not automatically record meetings." },
  { question: "Who can see my meetings?", answer: "Your meeting library is private to your account. You can explicitly create or revoke a public link for a meeting or highlight. Team-wide sharing is not available." },
  { question: "What do the summary and highlight preferences do?", answer: "They affect future AI analyses. They do not rewrite existing results. Suggested highlights remain separate from highlights you create yourself." },
  { question: "What happens after the 14-day Pro trial?", answer: "Paid Pro and Max plans are planned but checkout and automatic billing are not connected. Existing preview features remain subject to available credits." },
  { question: "Can I delete my account?", answer: "Self-service account and recording deletion is not available in this test project. Signing out does not delete stored data." },
];

export default function FAQsPage() {
  return <section aria-label="FAQs" className="fade-in max-w-3xl">
    <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs text-muted">Help</p><h1 className="mt-1 text-xl font-semibold text-ink">FAQs</h1></div><Link href="/my-calls" className="text-xs text-brand hover:underline">Back to calls</Link></div>
    <div className="surface divide-y divide-[#253345]">{questions.map(({ question, answer }) => <div key={question} className="p-5"><h2 className="text-sm font-semibold text-ink">{question}</h2><p className="mt-2 text-xs leading-5 text-muted">{answer}</p></div>)}</div>
  </section>;
}
