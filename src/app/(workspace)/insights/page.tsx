import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMeetingDuration, getLatestRecording, type DbMeetingRecord } from "@/lib/meetings";

export default async function InsightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = user
    ? await supabase.from("meetings")
      .select("*, recordings(*), action_items(id), highlights(id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    : { data: null, error: null };
  const meetings = (data ?? []) as DbMeetingRecord[];

  return <section aria-label="Insights" className="fade-in min-w-0">
    <h1 className="sr-only">Insights</h1>
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="text-xs text-[#64748b]">Meeting activity · your calls</span>
      <span className="rounded-md border border-[#151e2b] bg-[#080c14] px-2.5 py-1 text-[11px] font-medium text-[#64748b]">All time</span>
    </div>
    {error ? (
      <p role="alert" className="rounded-lg border border-[#131b26] bg-[#070a10] px-4 py-4 text-xs text-[#64748b]">Could not load meeting activity. Try refreshing this page.</p>
    ) : meetings.length === 0 ? (
      <p className="rounded-lg border border-[#131b26] bg-[#070a10] px-4 py-4 text-xs text-[#64748b]">No meeting activity yet. Upload a recording in My Calls to get started.</p>
    ) : (
      <div className="overflow-hidden rounded-lg border border-[#131b26] bg-[#070a10]">
        <div className="hidden grid-cols-[minmax(0,1fr)_110px_110px_100px] gap-3 border-b border-[#131b26] bg-[#05070c] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[.1em] text-[#52637a] sm:grid">
          <span>Meeting</span><span>Action items</span><span>Highlights</span><span>Duration</span>
        </div>
        {meetings.map((meeting) => (
          <div key={meeting.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-[#0e141f] px-4 py-3 text-xs last:border-b-0 hover:bg-[#090d15] transition-colors duration-150 sm:grid-cols-[minmax(0,1fr)_110px_110px_100px] sm:items-center">
            <Link href={"/meeting/" + meeting.id} className="min-w-0 truncate font-semibold text-[#f1f5f9] hover:text-[#3b82f6] transition-colors">{meeting.title || "Untitled Meeting"}</Link>
            <span className="text-right text-[#64748b] sm:text-left">{meeting.action_items?.length ?? 0}<span className="sm:hidden"> actions</span></span>
            <span className="text-[#64748b] sm:col-auto">{meeting.highlights?.length ?? 0} <span className="sm:hidden">highlights</span></span>
            <span className="text-right text-[#64748b] sm:text-left">{formatMeetingDuration(getLatestRecording(meeting)?.duration_seconds || meeting.duration_seconds || meeting.duration)}</span>
          </div>
        ))}
      </div>
    )}
  </section>;
}
