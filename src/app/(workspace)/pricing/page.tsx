import Link from "next/link";
import { Check } from "lucide-react";

const plans = [
  { name: "Pro", price: "Coming soon", features: ["14-day trial for every new account, including Demo guests", "50 starting credits per new account", "Meeting library, transcripts, summaries, and highlights"] },
  { name: "Max", price: "Coming soon", features: ["Paid plan details and limits are not finalized", "No upgrade or checkout is available yet"] }
];

export default function PricingPage() {
  return <section aria-label="Plans and billing" className="fade-in max-w-3xl">
    <div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs text-muted">Plans · billing is not connected</span><Link href="/my-calls" className="text-xs text-brand hover:underline">Back to calls</Link></div>
    <h1 className="mb-3 text-xl font-semibold text-ink">Pricing</h1>
    <p className="mb-4 text-xs leading-5 text-muted">Every new account, including a Demo guest, has a 14-day Pro trial from sign-up and starts with 50 credits. Pro and Max will require payment after the trial once billing is launched; no payment is collected or charged automatically in this preview. Processing uses your available balance at one credit per started minute. Credit top-ups and recurring allowances are not connected.</p>
    <div className="grid gap-3 sm:grid-cols-2">{plans.map((plan) => <div key={plan.name} className="surface p-5">
      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink">{plan.name}</p><p className="text-sm font-semibold text-brand">{plan.price}</p></div>
      <div className="mt-4 space-y-2 border-t border-[#253345] pt-4">{plan.features.map((feature) => <p key={feature} className="flex items-center gap-2 text-xs text-muted"><Check size={14} className="text-brand" />{feature}</p>)}</div>
    </div>)}</div>
  </section>;
}
