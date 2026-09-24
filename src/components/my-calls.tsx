"use client";

import { useState } from "react";
import { Search, Upload } from "lucide-react";
import { meetings } from "@/lib/sample-data";
import { MeetingList } from "@/components/meeting-list";
import { Button, Dropdown, EmptyState } from "@/components/ui";

type Scope = "all" | "shared";
type TypeFilter = "all" | "Internal" | "Customer" | "Planning";

export function MyCalls() {
  const [scope, setScope] = useState<Scope>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const visible = scope === "shared" ? [] : meetings.filter((meeting) => {
    const matchesType = type === "all" || meeting.category === type;
    return matchesType;
  });

  return (
    <section aria-label="My Calls" className="fade-in min-w-0">
      <h1 className="sr-only">My Calls</h1>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setScope("all")} aria-pressed={scope === "all"} className={"rounded-md border px-3 py-2 text-xs font-semibold " + (scope === "all" ? "border-[#1e2a3a] bg-[#0f1520] text-ink" : "border-[#1a2433] bg-transparent text-muted hover:text-ink")}>All calls</button>
        <button type="button" onClick={() => setScope("shared")} aria-pressed={scope === "shared"} className={"rounded-md border px-3 py-2 text-xs font-semibold " + (scope === "shared" ? "border-[#1e2a3a] bg-[#0f1520] text-ink" : "border-[#1a2433] bg-transparent text-muted hover:text-ink")}>Shared with me</button>
        <Dropdown
          label={<><span>Filters</span>{type !== "all" && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}</>}
          items={[
            { label: "All types", onClick: () => setType("all") },
            { label: "Internal", onClick: () => setType("Internal") },
            { label: "Customer", onClick: () => setType("Customer") },
            { label: "Planning", onClick: () => setType("Planning") }
          ]}
        />
        <Button size="sm" disabled title="Recording upload will be available in a later step" className="ml-auto"><Upload size={14} /> Upload recording</Button>
      </div>

      {visible.length ? <MeetingList meetings={visible} /> : (
        <EmptyState
          icon={<Search size={20} />}
          title={scope === "shared" ? "No shared calls yet" : "No meetings found"}
          description={scope === "shared" ? "Meetings shared with you will appear here when sharing is connected." : "Try another search or filter."}
          action={scope === "shared"
            ? <Button variant="secondary" size="sm" onClick={() => setScope("all")}>View all calls</Button>
            : <Button variant="secondary" size="sm" onClick={() => setType("all")}>Clear filters</Button>}
        />
      )}
    </section>
  );
}
