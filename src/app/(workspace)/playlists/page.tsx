import Link from "next/link";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui";

const collections = [
  { title: "Product decisions", detail: "Product weekly sync · Quarterly planning workshop", meetings: [{ id: "product-weekly-sync", title: "Product weekly sync" }, { id: "quarterly-planning-workshop", title: "Quarterly planning workshop" }] },
  { title: "Customer conversations", detail: "Acme discovery call", meetings: [{ id: "acme-discovery-call", title: "Acme × Discovery call" }] }
];

export default function PlaylistsPage() {
  return <section aria-label="Playlists" className="fade-in min-w-0">
    <h1 className="sr-only">Playlists</h1>
    <div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs text-muted">Sample collections</span><Button size="sm" disabled title="Playlist creation will be available later"><Plus size={14} /> Create playlist</Button></div>
    <div className="surface divide-y divide-[#253345]">
      {collections.map((collection) => <div key={collection.title} className="flex min-w-0 flex-wrap items-start gap-3 px-4 py-4 sm:gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1a3046] text-brand"><FolderOpen size={17} /></span>
        <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold text-ink">{collection.title}</p><p className="mt-1 truncate text-[11px] text-muted">{collection.detail}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{collection.meetings.map((meeting) => <Link key={meeting.id} href={"/meeting/" + meeting.id} className="text-[11px] text-brand hover:underline">{meeting.title}</Link>)}</div></div>
        <span className="text-[11px] text-muted">{collection.meetings.length} calls</span>
      </div>)}
    </div>
    <p className="mt-2 text-[10px] text-[#718399]">Collections are sample UI; clips and private sharing are not connected.</p>
  </section>;
}
