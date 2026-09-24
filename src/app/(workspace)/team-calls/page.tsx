"use client";

import { useState } from "react";
import { Search, Users } from "lucide-react";
import { MeetingList } from "@/components/meeting-list";
import { EmptyState } from "@/components/ui";
import { meetings } from "@/lib/sample-data";

export default function TeamCallsPage() {
  const [query, setQuery] = useState("");
  const teamMeetings = meetings.filter((meeting) => meeting.category === "Internal");
  const visible = teamMeetings.filter((meeting) => (meeting.title + " " + meeting.summary).toLowerCase().includes(query.trim().toLowerCase()));

  return <section aria-label="Team Calls" className="fade-in min-w-0">
    <h1 className="sr-only">Team Calls</h1>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-medium text-muted">{teamMeetings.length} sample team calls</span>
      <label className="field flex h-9 w-full items-center gap-2 px-3 sm:w-56"><Search size={14} className="text-muted" /><input aria-label="Search team calls" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search team calls" className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none" /></label>
    </div>
    {visible.length ? <MeetingList meetings={visible} /> : <EmptyState icon={<Users size={20} />} title="No team calls found" description="Try another search. Team sharing will be connected in a later step." />}
  </section>;
}
