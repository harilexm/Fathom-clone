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
              <span className="block truncate text-[14px] font-semibold text-ink group-hover:text-brand">{meeting.title}</span>
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
