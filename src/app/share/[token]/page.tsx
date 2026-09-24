import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { findMeeting, meetings } from "@/lib/sample-data";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const meeting = token === "sample-preview" ? meetings[0] : token.startsWith("sample-") ? findMeeting(token.slice(7)) : undefined;
  if (!meeting) notFound();
  return <main className="min-h-screen bg-canvas px-5 py-5"><div className="mx-auto max-w-3xl">
    <div className="mb-8 flex items-center justify-between"><Link href="/my-calls" className="text-[15px] font-black tracking-[.13em] text-ink">FATHOM<span className="text-brand">.</span></Link><span className="text-[10px] font-semibold uppercase tracking-[.1em] text-brand">Sharing preview</span></div>
    <div className="surface p-5 sm:p-6"><h1 className="text-xl font-semibold text-ink">{meeting.title}</h1><p className="mt-1 text-xs text-muted">{meeting.date} · {meeting.duration}</p><p className="mt-5 rounded-lg border border-[#2b4f70] bg-[#132b43] p-3 text-xs leading-5 text-[#bdddf8]">Sample content only. This page does not grant access to a private recording or create a live share link.</p><p className="mt-5 text-xs leading-6 text-[#c8d4e1]">{meeting.summary}</p><div className="mt-5 space-y-2 border-t border-[#253345] pt-4">{meeting.overview.map((point) => <p key={point} className="text-xs leading-5 text-muted">• {point}</p>)}</div></div>
    <Link href="/my-calls" className="mt-5 inline-flex items-center gap-2 text-xs text-brand hover:underline"><ArrowLeft size={14} /> Back to calls</Link>
  </div></main>;
}
