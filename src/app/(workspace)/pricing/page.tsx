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
        <div className="border-b border-[#1e2a3a] pb-6">
          <Link
            href="/my-calls"
            className="mb-3 inline-flex items-center text-xs font-semibold text-[#8da3be] hover:text-white transition"
          >
            ← Back to Calls
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Plans &amp; Billing</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Pricing</h1>
          <p className="mt-1.5 text-xs text-[#8da3be]">
            Simple credit-based processing with an inclusive 14-day trial for every workspace.
          </p>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`surface flex flex-col justify-between rounded-2xl border p-6 shadow-sm transition ${
                plan.isPopular ? "border-[#38567c] bg-[#0d1624]" : "border-[#223348]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand">{plan.name}</span>
                  {plan.badge && (
                    <span className="rounded-full bg-[#1b2b3f] px-2.5 py-0.5 text-[10px] font-bold text-[#8bb9f0]">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight text-white">{plan.price}</span>
                  <span className="text-xs text-[#7e95ad]">/ {plan.period}</span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-[#9ab0c7]">{plan.description}</p>

                <div className="mt-6 border-t border-[#1e2d3f] pt-5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6a8099]">What&apos;s Included</span>
                  <ul className="mt-3 space-y-2.5 text-xs text-[#c0d0e2]">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 leading-snug">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 border-t border-[#1e2d3f] pt-5">
                {plan.isPopular ? (
                  <Link
                    href={plan.ctaHref}
                    className="block w-full rounded-xl bg-brand py-2.5 text-center text-xs font-bold text-white transition hover:bg-brand/90 shadow-md shadow-brand/20"
                  >
                    {plan.ctaLabel}
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-xl border border-[#2b3b4e] bg-[#121c29] py-2.5 text-center text-xs font-semibold text-[#6e849d] cursor-not-allowed"
                  >
                    {plan.ctaLabel}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Credit Model Info Box */}
        <div className="rounded-2xl border border-[#202d3d] bg-[#0c131e] p-6 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#8da3be]">How Processing Credits Work</h2>
          <div className="mt-3 space-y-2 text-xs leading-relaxed text-[#8da3be]">
            <p>
              • Media processing uses your credit balance at a rate of <strong className="text-white">one credit per started minute</strong> of recording duration.
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
