import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui";

const plans = [
  { name: "Free", price: "$0", features: ["Meeting library", "Notes and transcripts", "Personal workspace"] },
  { name: "Premium", price: "Coming soon", features: ["Everything in Free", "Advanced AI workflows", "Sharing and clips"] }
];

export default function PricingPage() {
  return <section aria-label="Plans and billing" className="fade-in max-w-3xl">
    <div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs text-muted">Plan preview · billing is not connected</span><Link href="/my-calls" className="text-xs text-brand hover:underline">Back to calls</Link></div>
    <div className="grid gap-3 sm:grid-cols-2">{plans.map((plan) => <div key={plan.name} className="surface p-5">
      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink">{plan.name}</p><p className="text-sm font-semibold text-brand">{plan.price}</p></div>
      <div className="mt-4 space-y-2 border-t border-[#253345] pt-4">{plan.features.map((feature) => <p key={feature} className="flex items-center gap-2 text-xs text-muted"><Check size={14} className="text-brand" />{feature}</p>)}</div>
      <Button size="sm" variant="secondary" className="mt-5 w-full" disabled>{plan.name === "Free" ? "Current preview" : "Not available yet"}</Button>
    </div>)}</div>
  </section>;
}
