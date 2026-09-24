"use client";

import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { meetings } from "@/lib/sample-data";
import { MeetingList } from "@/components/meeting-list";
import { EmptyState } from "@/components/ui";

export function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const term = query.trim().toLowerCase();
  const results = term
    ? meetings.filter((meeting) => [meeting.title, meeting.summary, ...meeting.attendees, ...meeting.transcript.map((turn) => turn.text)].some((text) => text.toLowerCase().includes(term)))
    : meetings;

  return <section aria-label="Search meetings" className="fade-in min-w-0 mt-6">
    {results.length ? <MeetingList meetings={results} /> : <EmptyState icon={<Search size={20} />} title="No matching calls" description="Try a different word or person." />}
    <p className="mt-4 text-[10px] text-[#718399]">{results.length} sample results · global preview search</p>
  </section>;
}
