"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { meetings } from "@/lib/sample-data";
import { MeetingList } from "@/components/meeting-list";
import { EmptyState } from "@/components/ui";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const results = term
    ? meetings.filter((meeting) => [meeting.title, meeting.summary, ...meeting.attendees, ...meeting.transcript.map((turn) => turn.text)].some((text) => text.toLowerCase().includes(term)))
    : meetings;

  return <section aria-label="Search meetings" className="fade-in min-w-0">
    <label className="field mb-3 flex h-10 items-center gap-2 px-3 focus-within:border-[#4c87b9]"><Search size={16} className="text-muted" /><input autoFocus aria-label="Search all meetings" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search calls, people, or transcript text" className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none" /></label>
    {results.length ? <MeetingList meetings={results} /> : <EmptyState icon={<Search size={20} />} title="No matching calls" description="Try a different word or person." />}
    <p className="mt-2 text-[10px] text-[#718399]">{results.length} sample results · local preview search</p>
  </section>;
}
