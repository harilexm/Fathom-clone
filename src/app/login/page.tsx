import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";

export default function LoginPage() {
  return <main className="flex min-h-screen flex-col bg-canvas px-5 py-5">
    <Link href="/my-calls" className="text-[15px] font-black tracking-[.13em] text-ink">FATHOM<span className="text-brand">.</span></Link>
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-brand">Product preview</p>
      <h1 className="text-2xl font-semibold text-ink">Welcome back</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Explore the meeting workspace with local sample calls.</p>
      <div className="surface mt-6 p-5"><p className="text-xs leading-5 text-muted">Sign-in is not connected. You can open the sample workspace directly.</p><Link href="/my-calls" className="mt-4 block"><Button className="w-full">Open workspace <ArrowRight size={15} /></Button></Link></div>
      <Link href="/onboarding" className="mt-5 text-center text-xs text-brand hover:underline">See the welcome flow</Link>
    </div>
    <p className="text-[10px] text-muted">Sample UI · No account is created</p>
  </main>;
}
