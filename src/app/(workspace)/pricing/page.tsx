import Link from "next/link";

interface PlanCard {
  name: string;
  badge?: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  isPopular?: boolean;
}

const plans: PlanCard[] = [
  {
    name: "Pro Trial",
    badge: "Current Plan",
    price: "$0",
    period: "14-day preview trial",
    description: "Full access to meeting intelligence, transcription, and AI notes with starter credits.",
    features: [
      "50 complimentary processing credits included",
      "Fast speech-to-text transcription with speaker diarization",
      "Automated meeting notes, action items, and auto highlights",
      "Interactive Ask Fathom assistant across all meetings",
      "Private workspace with secure public highlight sharing",
    ],
    ctaLabel: "Active Workspace Plan",
    ctaHref: "/my-calls",
    isPopular: true,
  },
  {
    name: "Max",
    badge: "Upcoming",
    price: "Coming Soon",
    period: "Automated billing preview",
    description: "Expanded limits and team collaboration features designed for growing organizations.",
    features: [
      "Higher monthly recording allowances and credit bundles",
      "Team-wide shared workspaces and shared call folders",
      "Custom summary prompts and organizational templates",
      "Priority asynchronous transcription processing",
      "Centralized administrative access controls",
    ],
    ctaLabel: "Coming Soon",
    ctaHref: "#",
    isPopular: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-full py-8 px-4 sm:px-6">
      <section aria-label="Plans and billing" className="fade-in mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="border-b border-[#131b26] pb-6">
          <Link
            href="/my-calls"
            className="mb-3 inline-flex items-center text-xs font-semibold text-muted hover:text-[#f1f5f9] transition"
          >
            ← Back to Calls
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Plans &amp; Billing</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f1f5f9] sm:text-3xl">Pricing</h1>
          <p className="mt-1.5 text-xs text-muted">
            Simple credit-based processing with an inclusive 14-day trial for every workspace.
          </p>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col justify-between rounded-xl border p-6 shadow-sm transition ${
                plan.isPopular ? "border-[#1d3557] bg-[#070a10]" : "border-[#131b26] bg-[#070a10]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand">{plan.name}</span>
                  {plan.badge && (
                    <span className="rounded-full bg-[#0c182b] border border-[#1d3557] px-2.5 py-0.5 text-[10px] font-bold text-[#60a5fa]">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight text-[#f1f5f9]">{plan.price}</span>
                  <span className="text-xs text-muted">/ {plan.period}</span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-[#cbd5e1]">{plan.description}</p>

                <div className="mt-6 border-t border-[#131b26] pt-5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">What&apos;s Included</span>
                  <ul className="mt-3 space-y-2.5 text-xs text-[#cbd5e1]">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 leading-snug">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 border-t border-[#131b26] pt-5">
                {plan.isPopular ? (
                  <Link
                    href={plan.ctaHref}
                    className="block w-full rounded-lg bg-brand py-2.5 text-center text-xs font-semibold text-white transition hover:bg-brand-hover"
                  >
                    {plan.ctaLabel}
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-lg border border-[#151e2b] bg-[#080c14] py-2.5 text-center text-xs font-semibold text-muted cursor-not-allowed"
                  >
                    {plan.ctaLabel}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Credit Model Info Box */}
        <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">How Processing Credits Work</h2>
          <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
            <p>
              • Media processing uses your credit balance at a rate of <strong className="text-[#f1f5f9]">one credit per started minute</strong> of recording duration.
            </p>
            <p>
              • Credits are only deducted after transcription and AI summary generation complete successfully. Failed processing uses zero credits.
            </p>
            <p>
              • Text chat questions in Ask Fathom are free and consume zero credits.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
