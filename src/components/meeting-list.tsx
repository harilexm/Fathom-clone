"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import type { Meeting } from "@/lib/sample-data";
import { ParticipantAvatars } from "@/components/participant-avatars";
import { Dropdown } from "@/components/ui";

export function MeetingList({ meetings }: { meetings: Meeting[] }) {
  const router = useRouter();
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-[#131b26] bg-[#070a10]">
      <div className="hidden grid-cols-[minmax(0,1fr)_160px_90px_140px_40px] gap-4 border-b border-[#131b26] bg-[#05070c] px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[.1em] text-[#52637a] lg:grid">
        <span>Meeting</span><span>Date &amp; time</span><span>Duration</span><span>Participants</span><span className="sr-only">Actions</span>
      </div>
      <div role="list" aria-label="Meetings">
        {meetings.map((meeting) => (
          <div role="listitem" key={meeting.id} className="group grid min-w-0 grid-cols-[minmax(0,1fr)_40px] items-start gap-x-4 gap-y-2 border-b border-[#0e141f] px-5 py-3.5 last:border-b-0 hover:bg-[#090d15] transition-colors duration-150 lg:grid-cols-[minmax(0,1fr)_160px_90px_140px_40px] lg:items-center">
            <Link href={"/meeting/" + meeting.id} className="min-w-0 rounded-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3b82f6]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[13.5px] font-semibold text-[#f1f5f9] group-hover:text-[#3b82f6] transition-colors">{meeting.title}</span>
                {meeting.isDemo && (
                  <span className="inline-flex items-center rounded bg-[#0e1420] px-1.5 py-0.5 text-[9.5px] font-medium tracking-wide text-[#64748b] border border-[#151e2b]">
                    Demo
                  </span>
                )}
                {meeting.status && (
                  <span className={"inline-flex items-center rounded px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider " + (
                    meeting.status.toLowerCase() === "uploaded" ? "bg-[#0d131d] text-[#94a3b8] border border-[#172232]" :
                    meeting.status.toLowerCase() === "transcribing" ? "bg-[#0d172b] text-[#60a5fa] border border-[#162b4d]" :
                    meeting.status.toLowerCase() === "analyzing" ? "bg-[#0e1a33] text-[#7ea5e8] border border-[#1a315e]" :
                    (meeting.status.toLowerCase() === "ready" || meeting.status.toLowerCase() === "completed") ? "bg-[#051c14] text-[#34d399] border border-[#0d3b2b]" :
                    meeting.status.toLowerCase() === "processing" ? "bg-[#0d131d] text-[#94a3b8] border border-[#172232]" :
                    meeting.status.toLowerCase() === "failed" ? "bg-[#240c11] text-[#f87171] border border-[#481822]" :
                    "bg-[#0a0f18] text-[#64748b] border border-[#131b26]"
                  )}>
                    {meeting.status}
                  </span>
                )}
              </div>
              <span className="mt-1 block truncate text-[12px] leading-4 text-[#64748b]">{meeting.summary}</span>
            </Link>
            <div className="col-start-1 row-start-2 flex flex-wrap items-center gap-x-2 text-[12px] text-[#64748b] lg:col-auto lg:row-auto lg:block">
              <span suppressHydrationWarning>{meeting.date}</span>
              <span suppressHydrationWarning className="mt-0.5 block text-[11px] text-[#52637a]">{meeting.time}</span>
              <span className="lg:hidden">· {meeting.duration}</span>
            </div>
            <span className="hidden text-[12.5px] text-[#64748b] lg:block">{meeting.duration}</span>
            <div className="col-start-1 row-start-3 lg:col-auto lg:row-auto"><ParticipantAvatars people={meeting.attendees} /></div>
            <div className="col-start-2 row-start-1 justify-self-end lg:col-auto lg:row-auto">
              <Dropdown
                label={<MoreHorizontal size={16} />}
                showChevron={false}
                variant="ghost"
                ariaLabel={"Actions for " + meeting.title}
                items={[
                  { label: "Open meeting", onClick: () => router.push("/meeting/" + meeting.id) }
                ]}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
