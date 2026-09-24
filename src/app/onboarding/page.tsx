import Link from "next/link";
import { ArrowRight, FileText, ListTodo, Search } from "lucide-react";
import { Button } from "@/components/ui";

const steps = [
  { title: "Find a call", text: "Browse and search your meeting list.", icon: Search },
  { title: "Review the conversation", text: "Read notes and speaker transcripts.", icon: FileText },
  { title: "Follow through", text: "Keep decisions and action items close to their source.", icon: ListTodo }
];

export default function OnboardingPage() {
  return <main className="min-h-screen bg-canvas px-5 py-5">
    <div className="mx-auto max-w-3xl"><Link href="/my-calls" className="text-[15px] font-black tracking-[.13em] text-ink">FATHOM<span className="text-brand">.</span></Link>
      <p className="mb-3 mt-14 text-[11px] font-semibold uppercase tracking-[.12em] text-brand">Preview workspace</p>
      <h1 className="text-2xl font-semibold text-ink">From call to follow-through</h1>
      <div className="surface mt-6 divide-y divide-[#253345]">{steps.map(({ title, text, icon: Icon }, index) => <div key={title} className="flex items-start gap-4 p-4"><span className="w-5 text-xs font-semibold text-muted">0{index + 1}</span><Icon size={18} className="text-brand" /><div><p className="text-xs font-semibold text-ink">{title}</p><p className="mt-1 text-xs text-muted">{text}</p></div></div>)}</div>
      <Link href="/my-calls" className="mt-5 inline-block"><Button>Explore calls <ArrowRight size={15} /></Button></Link>
      <p className="mt-3 text-[10px] text-muted">No integrations or account setup are required in this preview.</p>
    </div>
  </main>;
}
