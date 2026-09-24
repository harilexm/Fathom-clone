"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft, Bookmark, Check, CheckCircle2, ChevronRight, Circle,
  Copy, Download, ListTodo, Maximize2, MoreHorizontal, Play, Plus,
  Search, Share2, Sparkles, WandSparkles
} from "lucide-react";
import type { Meeting, TranscriptTurn } from "@/lib/sample-data";
import { ParticipantAvatars } from "@/components/participant-avatars";
import { Button, Card, Dropdown, Modal, Tabs } from "@/components/ui";

function RecordingPlaceholder({ duration }: { duration: string }) {
  return (
    <Card className="overflow-hidden">
      <div
        role="img"
        aria-label="Recording placeholder. No video is attached to this sample meeting."
        className="relative flex aspect-video max-h-[300px] min-h-[180px] items-center justify-center overflow-hidden bg-[#0d1623] sm:min-h-[230px]"
      >
        <div className="relative z-10 px-4 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#38506a] bg-[#16263a] text-white backdrop-blur">
            <Play size={18} fill="white" className="ml-0.5" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-white">No recording attached</p>
          <p className="mt-1 text-xs text-white/60">Playback will appear here when a recording is connected.</p>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" disabled aria-label="Play recording unavailable" className="text-[#64768b]"><Play size={18} /></button>
        <span className="text-[11px] font-semibold text-muted">00:00</span>
        <div className="h-1.5 flex-1 rounded-full bg-[#223247]" aria-hidden="true" />
        <span className="text-[11px] font-semibold text-muted">{duration}</span>
        <button type="button" disabled aria-label="Fullscreen unavailable" className="text-[#64768b]"><Maximize2 size={15} /></button>
      </div>
    </Card>
  );
}

function SummaryPanel({ meeting, onTabChange }: { meeting: Meeting; onTabChange: (tab: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-brand">
            <Sparkles size={15} /> Meeting notes
            <span className="rounded bg-[#132b43] px-1.5 py-0.5 text-[10px] font-semibold">Sample</span>
          </div>

        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-[#2b3b4e] bg-[#172333] px-3 py-2 text-xs font-semibold text-[#acbbcc]">
          <WandSparkles size={14} /> General summary
        </span>
      </div>
      <p className="rounded-xl border border-[#2b4f70] bg-[#122235] p-4 text-sm leading-7 text-[#d2dce8]">{meeting.summary}</p>
      <section>
        <h3 className="mb-4 text-sm font-bold">Discussion overview</h3>
        <div className="space-y-4">
          {meeting.overview.map((point, index) => (
            <div key={point} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#132b43] text-[11px] font-bold text-brand">{index + 1}</span>
              <p className="pt-0.5 text-[13px] leading-6 text-[#acbbcc]">{point}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-4 border-t border-[#253345] pt-6 sm:grid-cols-2">
        {[
          { id: "actions", label: "Action items", count: meeting.actions.length, action: "View follow-ups", icon: ListTodo },
          { id: "highlights", label: "Highlights", count: meeting.highlights.length, action: "View moments", icon: Bookmark }
        ].map(({ id, label, count, action, icon: Icon }) => (
          <div key={id} className="rounded-xl border border-[#2b3b4e] p-4">
            <div className="mb-2 flex items-center gap-2 text-brand"><Icon size={16} /><span className="text-xs font-bold">{label}</span></div>
            <p className="text-2xl font-bold">{count}</p>
            <button type="button" onClick={() => onTabChange(id)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand hover:underline">{action} <ChevronRight size={13} /></button>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted">Additional summary templates will be available in a later step.</p>
    </div>
  );
}

function TranscriptPanel({ turns }: { turns: TranscriptTurn[] }) {
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState("all");
  const [limit, setLimit] = useState(24);
  const scrollArea = useRef<HTMLOListElement>(null);
  const speakers = Array.from(new Set(turns.map((turn) => turn.speaker)));
  const term = query.trim().toLowerCase();
  const visible = turns.filter((turn) =>
    (speaker === "all" || turn.speaker === speaker) &&
    (turn.speaker + " " + turn.text).toLowerCase().includes(term)
  );

  const shown = visible.slice(0, limit);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{turns.length} sample turns · {speakers.length} speakers</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[#2b3b4e] px-3 text-muted focus-within:border-[#4c87b9]">
            <Search size={14} />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(24); }} placeholder="Search transcript" aria-label="Search transcript" className="min-w-0 flex-1 text-xs text-ink outline-none sm:w-36" />
          </label>
          <select
            aria-label="Filter transcript by speaker"
            value={speaker}
            onChange={(event) => { setSpeaker(event.target.value); setLimit(24); }}
            className="h-10 max-w-full rounded-lg border border-[#2b3b4e] bg-[#172333] px-3 text-xs text-[#acbbcc] focus:border-[#4c87b9]"
          >
            <option value="all">All speakers</option>
            {speakers.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-[11px] text-muted">Showing {shown.length} of {visible.length} matching turns · {turns.length} total</p>
        {visible.length > 8 && (
          <div className="hidden gap-3 lg:flex">
            <button type="button" onClick={() => scrollArea.current?.scrollTo({ top: 0, behavior: "smooth" })} className="text-[11px] font-semibold text-brand hover:underline">Start</button>
            <button type="button" onClick={() => { setLimit(visible.length); requestAnimationFrame(() => scrollArea.current?.scrollTo({ top: scrollArea.current.scrollHeight, behavior: "smooth" })); }} className="text-[11px] font-semibold text-brand hover:underline">Latest</button>
          </div>
        )}
      </div>
      {visible.length ? (
        <ol ref={scrollArea} aria-label="Speaker transcript" className="space-y-1 lg:max-h-[720px] lg:overflow-y-auto lg:overscroll-contain lg:pr-2">
          {shown.map((turn) => (
            <li key={turn.id} className="group flex gap-3 rounded-xl px-2 py-4 hover:bg-[#152233]">
              <span className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold " + turn.color}>{turn.initials}</span>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-xs font-bold">{turn.speaker}</span>
                  <span className="whitespace-nowrap text-[11px] text-muted">{turn.time}</span>
                </div>
                <p className="break-words text-[13px] leading-6 text-[#acbbcc]">{turn.text}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div role="status" className="rounded-xl border border-dashed border-[#2b3b4e] px-4 py-12 text-center">
          <p className="text-sm font-semibold">No transcript lines found</p>
          <p className="mt-1 text-xs text-muted">Try another term or speaker.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => { setQuery(""); setSpeaker("all"); setLimit(24); }}>Clear filters</Button>
        </div>
      )}
      {visible.length > shown.length && <div className="pt-4 text-center"><Button variant="secondary" size="sm" onClick={() => setLimit(limit + 24)}>Show more turns ({visible.length - shown.length} remaining)</Button></div>}
    </div>
  );
}

function ActionItemsPanel({ meeting, doneIds, onToggle }: { meeting: Meeting; doneIds: string[]; onToggle: (id: string) => void }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">{meeting.actions.length} sample follow-ups</p>
        <Button variant="secondary" size="sm" disabled title="Editing actions will be available later"><Plus size={14} /> Add item</Button>
      </div>
      <div className="space-y-3">
        {meeting.actions.map((item) => {
          const done = doneIds.includes(item.id);
          return (
            <div key={item.id} className="flex items-start gap-3 rounded-xl border border-[#2b3b4e] p-4">
              <button
                type="button"
                aria-label={(done ? "Mark incomplete: " : "Mark complete: ") + item.text}
                aria-pressed={done}
                onClick={() => onToggle(item.id)}
                className="mt-0.5 shrink-0 rounded-full text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {done ? <CheckCircle2 size={19} /> : <Circle size={19} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={"break-words text-[13px] font-semibold " + (done ? "text-[#77899f] line-through" : "text-ink")}>{item.text}</p>
                <p className="mt-2 text-[11px] text-muted">{item.owner} <span className="mx-1">·</span> Due {item.due}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[11px] text-muted">Changes here are only visible until this page is refreshed.</p>
    </div>
  );
}

function HighlightsPanel({ meeting }: { meeting: Meeting }) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">{meeting.highlights.length} sample highlights</p>
        <Button variant="secondary" size="sm" disabled title="Clip creation will be available later"><Plus size={14} /> Create clip</Button>
      </div>
      <div className="space-y-3">
        {meeting.highlights.map((item) => (
          <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-[#2b3b4e] p-4 sm:gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#132b43] text-brand"><Bookmark size={17} /></span>
            <div className="min-w-0 flex-1"><p className="break-words text-[13px] font-bold">{item.title}</p><p className="mt-1 text-[11px] text-muted">{item.kind}</p></div>
            <span className="shrink-0 rounded-lg bg-[#223247] px-2 py-1 text-[11px] font-semibold text-[#acbbcc]">{item.time}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-muted">Clips and playback will be connected when recordings are available.</p>
    </div>
  );
}

function SharePreviewModal({ meeting, open, onClose }: { meeting: Meeting; open: boolean; onClose: () => void }) {
  const previewPath = "/share/sample-" + meeting.id;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  async function copySampleLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin + previewPath);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  return (
    <Modal title="Share this meeting" open={open} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <div className="rounded-xl bg-[#132b43] p-4 text-sm leading-6 text-[#d2dce8]">
        <p className="font-bold">Sharing preview</p>
        <p className="mt-1">This is a sample meeting. The link opens a preview page; private sharing and access controls will be added with the backend.</p>
      </div>
      <button type="button" onClick={copySampleLink} className="mt-4 flex w-full items-center justify-between rounded-xl border border-[#2b3b4e] px-3 py-2.5 text-left text-xs text-muted">
        <span className="truncate">{previewPath}</span>
        {copyState === "copied" ? <Check size={15} className="text-[#6cd3a5]" /> : <Copy size={15} />}
      </button>
      <p role="status" className="mt-2 min-h-4 text-[11px] text-muted">{copyState === "copied" ? "Preview link copied." : copyState === "failed" ? "Copy failed. Open the preview page instead." : ""}</p>
      <Link href={previewPath} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand" onClick={onClose}>Open preview page <ChevronRight size={13} /></Link>
    </Modal>
  );
}

export function MeetingWorkspace({ meeting }: { meeting: Meeting }) {
  const [tab, setTab] = useState("summary");
  const [shareOpen, setShareOpen] = useState(false);
  const [doneIds, setDoneIds] = useState<string[]>(meeting.actions.filter((item) => item.done).map((item) => item.id));

  function toggleDone(id: string) {
    setDoneIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <div className="fade-in min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <Link href="/my-calls" className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-brand"><ArrowLeft size={15} /> Back to My Calls</Link>
      </div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"><span>{meeting.date}</span><span>·</span><span>{meeting.time}</span><span>·</span><span>{meeting.duration}</span></div>
          <h1 className="max-w-4xl break-words text-[21px] font-semibold leading-tight tracking-tight sm:text-[24px]">{meeting.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs text-muted">
            <ParticipantAvatars people={meeting.attendees} maxVisible={4} />
            <span>{meeting.attendees.length} participants</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown label={<><Download size={14} /> Export</>} items={[{ label: "Export transcript (coming later)", disabled: true }, { label: "Export notes (coming later)", disabled: true }]} />
          <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}><Share2 size={15} /> Share</Button>
          <Dropdown label={<MoreHorizontal size={16} />} items={[{ label: "Rename meeting (coming later)", disabled: true }, { label: "Delete meeting (coming later)", disabled: true }]} />
        </div>
      </div>
      <div className="min-w-0 space-y-3">
          <RecordingPlaceholder duration={meeting.duration} />
          <Card className="min-w-0 overflow-hidden">
            <div className="border-b border-[#253345] px-4 pt-3 sm:px-5">
              <Tabs idBase="meeting-content" label="Meeting content" value={tab} onChange={setTab} items={[
                { id: "summary", label: "Summary" },
                { id: "transcript", label: "Transcript" },
                { id: "actions", label: "Action items", count: meeting.actions.length },
                { id: "highlights", label: "Highlights", count: meeting.highlights.length }
              ]} />
            </div>
            <div role="tabpanel" id="meeting-content-panel" aria-labelledby={"meeting-content-" + tab} className="p-4 sm:p-5">
              {tab === "summary" && <SummaryPanel meeting={meeting} onTabChange={setTab} />}
              {tab === "transcript" && <TranscriptPanel turns={meeting.transcript} />}
              {tab === "actions" && <ActionItemsPanel meeting={meeting} doneIds={doneIds} onToggle={toggleDone} />}
              {tab === "highlights" && <HighlightsPanel meeting={meeting} />}
            </div>
          </Card>
      </div>
      <SharePreviewModal meeting={meeting} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
