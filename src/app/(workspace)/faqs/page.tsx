import Link from "next/link";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  items: FAQItem[];
}

const faqCategories: FAQCategory[] = [
  {
    title: "Account & Access",
    items: [
      {
        question: "How can I sign in to the platform?",
        answer:
          "You can sign in using email and password, Google OAuth, or start immediately as a Demo Guest. Demo Guest creates a private anonymous session. To persist your data across sessions and devices, register with your email.",
      },
      {
        question: "What happens after the 14-day Pro trial expires?",
        answer:
          "Every new workspace begins with a complimentary 14-day Pro trial with 50 included credits. Automated billing and paid upgrades are not charged automatically during this preview.",
      },
      {
        question: "Can I delete my account or meeting records?",
        answer:
          "Meeting recordings and generated notes can be managed directly in your workspace. Permanent workspace deletion requests are processed by contacting workspace administration.",
      },
    ],
  },
  {
    title: "Recordings & Credits",
    items: [
      {
        question: "How do I add a new meeting to my library?",
        answer:
          "Click the '+ Upload recording' button in My Calls to upload an MP4, MP3, WebM, or M4A audio or video file. The file is uploaded directly to secure private storage and queued for automated transcription and AI analysis.",
      },
      {
        question: "When and how are processing credits deducted?",
        answer:
          "Credits are billed at one credit per started minute of processed media. Credits are deducted only after speech-to-text transcription and AI analysis succeed. If processing fails for any reason, zero credits are deducted. Text queries in Ask Fathom are free and use zero credits.",
      },
      {
        question: "Can I connect Google Calendar to my workspace?",
        answer:
          "Yes. Go to Settings and click 'Connect Calendar' to grant read-only calendar access. The connection synchronizes your scheduled meetings and attendees. Fathom never accesses your calendar without your explicit permission.",
      },
    ],
  },
  {
    title: "Sharing, Privacy & AI Intelligence",
    items: [
      {
        question: "Who can access my recordings and meeting notes?",
        answer:
          "By default, all uploaded meetings, audio files, and generated transcripts are strictly private to your authenticated workspace. Public sharing is only possible when you explicitly generate an active share link for a specific meeting or highlight clip.",
      },
      {
        question: "How do highlight clips work when shared?",
        answer:
          "When you share a highlight, recipients receive a dedicated trimmed clip view bounded strictly to that moment (e.g. 17 seconds). Viewers cannot access other parts of your recording unless you grant full meeting share access.",
      },
      {
        question: "What do the summary and highlight preferences do?",
        answer:
          "They configure the default templates and behaviors applied to future AI analyses. Changing these settings does not rewrite or overwrite any existing notes or transcripts already generated.",
      },
    ],
  },
];

export default function FAQsPage() {
  return (
    <div className="min-h-full py-8 px-4 sm:px-6">
      <section aria-label="Frequently Asked Questions" className="fade-in mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="border-b border-[#1e2a3a] pb-6">
          <Link
            href="/my-calls"
            className="mb-3 inline-flex items-center text-xs font-semibold text-[#8da3be] hover:text-white transition"
          >
            ← Back to Calls
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Help &amp; Documentation</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-1.5 text-xs text-[#8da3be]">
            Everything you need to know about processing recordings, AI notes, sharing, and workspace credits.
          </p>
        </div>

        {/* Categories */}
        <div className="space-y-8">
          {faqCategories.map((category) => (
            <div key={category.title} className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#8da3be] px-1">
                {category.title}
              </h2>
              <div className="surface rounded-2xl border border-[#223348] divide-y divide-[#1e2d3f] overflow-hidden shadow-sm">
                {category.items.map((item) => (
                  <div key={item.question} className="p-5 sm:p-6 transition hover:bg-[#121c2a]/40">
                    <h3 className="text-sm font-semibold text-white">
                      {item.question}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-[#9ab0c7]">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Help Notice */}
        <div className="rounded-2xl border border-[#202d3d] bg-[#0c131e] p-6 text-center">
          <h3 className="text-sm font-semibold text-white">Have more questions?</h3>
          <p className="mt-1.5 text-xs text-[#8da3be]">
            Use the Ask Fathom assistant on any meeting or explore your workspace settings.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              href="/settings"
              className="rounded-lg border border-[#2b3b4e] bg-[#141f2e] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1c2a3d] transition"
            >
              Open Settings
            </Link>
            <Link
              href="/my-calls"
              className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand/90 transition"
            >
              Go to My Calls
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
