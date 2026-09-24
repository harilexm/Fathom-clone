import Link from "next/link";
import { meetings } from "@/lib/sample-data";

export default function InsightsPage() {
  return <section aria-label="Insights" className="fade-in min-w-0">
    <h1 className="sr-only">Insights</h1>
    <div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs text-muted">Meeting activity · sample data</span><span className="rounded-md border border-[#2b3b4e] px-2.5 py-1.5 text-[11px] text-muted">All time</span></div>
    <div className="surface overflow-hidden">
      <div className="hidden grid-cols-[minmax(0,1fr)_110px_110px_100px] gap-3 border-b border-[#253345] bg-[#141f2c] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[.1em] text-muted sm:grid"><span>Meeting</span><span>Action items</span><span>Highlights</span><span>Duration</span></div>
      {meetings.map((meeting) => <div key={meeting.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-[#253345] px-4 py-3 text-xs last:border-b-0 sm:grid-cols-[minmax(0,1fr)_110px_110px_100px] sm:items-center">
        <Link href={"/meeting/" + meeting.id} className="min-w-0 truncate font-semibold text-ink hover:text-brand">{meeting.title}</Link>
        <span className="text-right text-muted sm:text-left">{meeting.actions.length}<span className="sm:hidden"> actions</span></span>
        <span className="text-muted sm:col-auto">{meeting.highlights.length} <span className="sm:hidden">highlights</span></span>
        <span className="text-right text-muted sm:text-left">{meeting.duration}</span>
      </div>)}
    </div>
    <p className="mt-2 text-[10px] text-[#718399]">These counts are derived from temporary sample meetings.</p>
  </section>;
}
