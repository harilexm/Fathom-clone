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
    <div className="surface min-w-0 overflow-hidden rounded-lg border border-[#1a2433]">
      <div className="hidden grid-cols-[minmax(0,1fr)_160px_90px_140px_40px] gap-4 border-b border-[#1a2433] px-5 py-3 text-[11px] font-semibold uppercase tracking-[.1em] text-muted lg:grid">
        <span>Meeting</span><span>Date &amp; time</span><span>Duration</span><span>Participants</span><span className="sr-only">Actions</span>
      </div>
      <div role="list" aria-label="Meetings">
        {meetings.map((meeting) => (
          <div role="listitem" key={meeting.id} className="group grid min-w-0 grid-cols-[minmax(0,1fr)_40px] items-start gap-x-4 gap-y-2 border-b border-[#141c29] px-5 py-4 last:border-b-0 hover:bg-[#0f1822] lg:grid-cols-[minmax(0,1fr)_160px_90px_140px_40px] lg:items-center">
            <Link href={"/meeting/" + meeting.id} className="min-w-0 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[14px] font-semibold text-ink group-hover:text-brand">{meeting.title}</span>
                {meeting.isDemo && (
                  <span className="inline-flex items-center rounded-full bg-[#1e2a3a]/70 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted border border-[#2a3b50]">
                    Demo
                  </span>
                )}
                {meeting.status && (
                  <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " + (
                    meeting.status.toLowerCase() === "uploaded" ? "bg-brand/10 text-brand border border-brand/20" :
                    meeting.status.toLowerCase() === "ready" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    meeting.status.toLowerCase() === "processing" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                    "bg-[#141c29] text-muted border border-[#1e2a3a]"
                  )}>
                    {meeting.status}
                  </span>
                )}
              </div>
              <span className="mt-1 block truncate text-[12px] leading-4 text-muted">{meeting.summary}</span>
            </Link>
            <div className="col-start-1 row-start-2 flex flex-wrap items-center gap-x-2 text-[12px] text-muted lg:col-auto lg:row-auto lg:block">
              <span>{meeting.date}</span>
              <span className="mt-0.5 block text-[11px]">{meeting.time}</span>
              <span className="lg:hidden">· {meeting.duration}</span>
            </div>
            <span className="hidden text-[13px] text-muted lg:block">{meeting.duration}</span>
            <div className="col-start-1 row-start-3 lg:col-auto lg:row-auto"><ParticipantAvatars people={meeting.attendees} /></div>
            <div className="col-start-2 row-start-1 justify-self-end lg:col-auto lg:row-auto">
              <Dropdown
                label={<MoreHorizontal size={18} />}
                showChevron={false}
                variant="ghost"
                ariaLabel={"Actions for " + meeting.title}
                items={[
                  { label: "Open meeting", onClick: () => router.push("/meeting/" + meeting.id) },
                  { label: "Export (coming later)", disabled: true }
                ]}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
