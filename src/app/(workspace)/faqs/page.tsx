import Link from "next/link";

const questions = [
  { question: "How can I sign in?", answer: "Use email and password, Google, or the Demo guest option on the sign-in page." },
  { question: "Where can I see my plan and trial?", answer: "Open Account in the top-right corner to see your current plan and Pro Trial status." },
  { question: "Can I change plans?", answer: "The Pricing page is a preview. Billing and plan changes are not available yet." },
];

export default function FAQsPage() {
  return <section aria-label="FAQs" className="fade-in max-w-3xl">
    <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs text-muted">Help</p><h1 className="mt-1 text-xl font-semibold text-ink">FAQs</h1></div><Link href="/my-calls" className="text-xs text-brand hover:underline">Back to calls</Link></div>
    <div className="surface divide-y divide-[#253345]">{questions.map(({ question, answer }) => <div key={question} className="p-5"><h2 className="text-sm font-semibold text-ink">{question}</h2><p className="mt-2 text-xs leading-5 text-muted">{answer}</p></div>)}</div>
  </section>;
}
