"use client";

import Link from "next/link";
import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  ArrowLeft, Bookmark, Check, CheckCircle2, ChevronRight, Circle,
  Copy, Download, ListTodo, Maximize2, MoreHorizontal, Play, Plus,
  Search, Share2, Sparkles, WandSparkles, Trash2, Globe, Lock, ExternalLink
} from "lucide-react";
import type { Meeting, TranscriptTurn, Highlight } from "@/lib/sample-data";
import { formatMeetingDuration, formatTimestamp } from "@/lib/meetings";
import { ParticipantAvatars } from "@/components/participant-avatars";
import { Button, Card, Dropdown, Modal, Tabs } from "@/components/ui";

export function RecordingPlaceholder({ duration, isDemo }: { duration: string; isDemo?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <div
        role="img"
        aria-label={isDemo ? "Demo meeting recording placeholder." : "Uploaded meeting recording placeholder."}
        className="relative flex aspect-video max-h-[300px] min-h-[180px] items-center justify-center overflow-hidden bg-[#0d1623] sm:min-h-[230px]"
      >
        <div className="relative z-10 px-4 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#38506a] bg-[#16263a] text-white backdrop-blur">
            <Play size={18} fill="white" className="ml-0.5" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-white">
            {isDemo ? "Sample recording preview" : "Recording stream unavailable"}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {isDemo
              ? "This is a sample fixture without an attached video file."
              : "The recording media is stored in Cloudflare R2, but the playback stream is currently unavailable."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          disabled
          aria-label="Play recording unavailable"
          title="Playback unavailable without active media stream"
          className="text-[#64768b]"
        >
          <Play size={18} />
        </button>
        <span className="text-[11px] font-semibold text-muted">00:00</span>
        <div className="h-1.5 flex-1 rounded-full bg-[#223247]" aria-hidden="true" />
        <span className="text-[11px] font-semibold text-muted">{duration}</span>
        <button
          type="button"
          disabled
          aria-label="Fullscreen unavailable"
          title="Fullscreen unavailable without active media stream"
          className="text-[#64768b]"
        >
          <Maximize2 size={15} />
        </button>
      </div>
    </Card>
  );
}

const RecordingPlayer = forwardRef<HTMLMediaElement, {
  playbackUrl: string;
  mimeType?: string;
  onDurationDetected?: (durationSec: number) => void;
}>(function RecordingPlayer({ playbackUrl, mimeType, onDurationDetected }, ref) {
  const internalAudioRef = useRef<HTMLAudioElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);

  // Expose the active media element to the parent via forwarded ref
  useImperativeHandle(ref, () => {
    if (mimeType?.startsWith("audio/")) {
      return internalAudioRef.current as HTMLMediaElement;
    }
    return internalVideoRef.current as HTMLMediaElement;
  });

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const el = e.currentTarget;
    const dur = el.duration;
    if (Number.isFinite(dur) && dur > 0) {
      onDurationDetected?.(Math.max(1, Math.round(dur)));
    } else if (dur === Infinity) {
      el.currentTime = 1e101;
      const onTimeUpdate = () => {
        el.removeEventListener("timeupdate", onTimeUpdate);
        const resolvedDur = el.duration === Infinity ? el.currentTime : el.duration;
        if (Number.isFinite(resolvedDur) && resolvedDur > 0) {
          onDurationDetected?.(Math.max(1, Math.round(resolvedDur)));
        }
      };
      el.addEventListener("timeupdate", onTimeUpdate);
    }
  };

  return (
    <Card className="overflow-hidden bg-[#0d1623]">
      {mimeType?.startsWith("audio/") ? (
        <div className="flex min-h-[180px] items-center px-4">
          <audio
            ref={internalAudioRef}
            aria-label="Meeting recording"
            controls
            preload="metadata"
            className="w-full"
            onLoadedMetadata={handleLoadedMetadata}
          >
            <source src={playbackUrl} type={mimeType} />
          </audio>
        </div>
      ) : (
        <video
          ref={internalVideoRef}
          aria-label="Meeting recording"
          controls
          preload="metadata"
          className="aspect-video max-h-[480px] w-full bg-black"
          onLoadedMetadata={handleLoadedMetadata}
        >
          <source src={playbackUrl} type={mimeType || "video/mp4"} />
        </video>
      )}
    </Card>
  );
});

export function PendingContent({
  meeting,
  type,
}: {
  meeting: Meeting;
  type: "summary" | "transcript" | "actions" | "highlights";
}) {
  const isFailed = meeting.analysisStatus === "failed";
  const isProcessing = meeting.analysisStatus === "processing";
  const isTranscribing = meeting.analysisStatus === "transcribing" || meeting.status?.toLowerCase() === "transcribing";
  const isAnalyzing = meeting.analysisStatus === "analyzing" || meeting.status?.toLowerCase() === "analyzing";
  const isPending = meeting.analysisStatus === "uploaded" || meeting.analysisStatus === "pending" || !meeting.analysisStatus;

  let title: string;
  let message: string;

  if (meeting.isDemo) {
    title = `${type.charAt(0).toUpperCase() + type.slice(1)} unavailable`;
    message = "Sample content is unavailable for this section.";
  } else if (isFailed) {
    const titles: Record<string, string> = {
      summary: "Summary unavailable",
      transcript: "Transcript unavailable",
      actions: "Action items unavailable",
      highlights: "Highlights unavailable",
    };
    title = titles[type];
    message = "Media processing failed for this recording. Content could not be generated.";
  } else if (isProcessing) {
    const titles: Record<string, string> = {
      summary: "Summary processing",
      transcript: "Transcript processing",
      actions: "Action items processing",
      highlights: "Highlights processing",
    };
    title = titles[type];
    message = "The recording is currently being processed. Results will appear automatically once analysis completes.";
  } else if (isTranscribing) {
    const titles: Record<string, string> = {
      summary: "Summary pending",
      transcript: "Transcribing audio",
      actions: "Action items pending",
      highlights: "Highlights pending",
    };
    const messages: Record<string, string> = {
      summary: "Speech-to-text transcription is currently running. AI summary generation will begin once transcription completes.",
      transcript: "Soniox asynchronous Speech-to-Text transcription is in progress with speaker diarization and timestamps.",
      actions: "Action items will be extracted automatically once transcription and AI analysis complete.",
      highlights: "Key moments and highlights will be identified once audio processing completes.",
    };
    title = titles[type];
    message = messages[type];
  } else if (isAnalyzing) {
    const titles: Record<string, string> = {
      summary: "Summary pending",
      transcript: "Transcript ready",
      actions: "Action items pending",
      highlights: "Highlights pending",
    };
    const messages: Record<string, string> = {
      summary: "Transcription completed. AI summarization is ready to begin.",
      transcript: "Speech-to-text transcript segments have been processed.",
      actions: "Action items will be extracted automatically once AI analysis completes.",
      highlights: "Key moments and highlights will be identified during AI analysis.",
    };
    title = titles[type];
    message = messages[type];
  } else if (isPending) {
    const titles: Record<string, string> = {
      summary: "Summary pending",
      transcript: "Transcript pending",
      actions: "Action items pending",
      highlights: "Highlights pending",
    };
    const messages: Record<string, string> = {
      summary: "Recording uploaded to storage. AI summary generation has not started yet.",
      transcript: "Recording uploaded to storage. Speech-to-text transcription has not started yet.",
      actions: "Action items will be extracted automatically once transcription and AI analysis complete.",
      highlights: "Key moments and highlights will be identified once audio processing completes.",
    };
    title = titles[type];
    message = messages[type];
  } else {
    const titles: Record<string, string> = {
      summary: "No summary generated",
      transcript: "No transcript generated",
      actions: "No action items",
      highlights: "No highlights",
    };
    const messages: Record<string, string> = {
      summary: "No AI summary is available for this meeting.",
      transcript: "No transcript segments were recorded for this meeting.",
      actions: "No action items were detected for this meeting.",
      highlights: "No key moments or highlights were identified for this meeting.",
    };
    title = titles[type];
    message = messages[type];
  }

  return (
    <div role="status" className="rounded-xl border border-dashed border-[#2b3b4e] px-4 py-10 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-xs text-muted">{message}</p>
      {isTranscribing && type === "transcript" && meeting.sonioxJobId && (
        <p className="mt-3 inline-block rounded bg-[#101722] px-2.5 py-1 font-mono text-[11px] text-muted border border-[#1e2a3a]">
          Soniox Job ID: {meeting.sonioxJobId}
        </p>
      )}
    </div>
  );
}

export function SummaryPanel({ meeting, onTabChange }: { meeting: Meeting; onTabChange: (tab: string) => void }) {
  if (!meeting.isDemo && !meeting.summaryAvailable) {
    return <PendingContent meeting={meeting} type="summary" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-brand">
            <Sparkles size={15} /> Meeting notes
            {meeting.isDemo && (
              <span className="rounded bg-[#132b43] px-1.5 py-0.5 text-[10px] font-semibold">Demo</span>
            )}
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl border border-[#2b3b4e] bg-[#172333] px-3 py-2 text-xs font-semibold text-[#acbbcc]">
          <WandSparkles size={14} /> {meeting.isDemo ? "General summary" : meeting.summaryVersion || "Summary"}
        </span>
      </div>
      <p className="rounded-xl border border-[#2b4f70] bg-[#122235] p-4 text-sm leading-7 text-[#d2dce8]">{meeting.summary}</p>
      {meeting.overview.length > 0 && (
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
      )}
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
      {meeting.isDemo && (
        <p className="text-[11px] text-muted">Additional summary templates will be available in a later step.</p>
      )}
    </div>
  );
}

export function TranscriptPanel({
  meeting,
  onSeek,
  onHighlightTurn,
}: {
  meeting: Meeting;
  onSeek?: (timeSec: number) => void;
  onHighlightTurn?: (turn: TranscriptTurn) => void;
}) {
  const turns: TranscriptTurn[] = meeting.transcript;
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

  if (turns.length === 0) {
    return <PendingContent meeting={meeting} type="transcript" />;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{turns.length} {meeting.isDemo ? "sample turns" : "turns"} · {speakers.length} speakers</p>
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
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{turn.speaker}</span>
                    {onSeek && turn.startTimeSec !== undefined ? (
                      <button
                        type="button"
                        onClick={() => onSeek(turn.startTimeSec!)}
                        className="whitespace-nowrap text-[11px] font-semibold text-brand/70 transition hover:text-brand hover:underline"
                        aria-label={`Seek to ${turn.time}`}
                        title={`Jump to ${turn.time}`}
                      >
                        {turn.time}
                      </button>
                    ) : (
                      <span className="whitespace-nowrap text-[11px] text-muted">{turn.time}</span>
                    )}
                  </div>
                  {onHighlightTurn && (
                    <button
                      type="button"
                      onClick={() => onHighlightTurn(turn)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition inline-flex items-center gap-1 rounded bg-[#1c2a3c] hover:bg-[#283b54] px-2 py-0.5 text-[11px] font-medium text-brand border border-[#2b3e55]"
                      title="Create highlight from this transcript moment"
                    >
                      <Bookmark size={11} /> Highlight
                    </button>
                  )}
                </div>
                <p className="break-words text-[13px] leading-6 text-[#acbbcc]">{turn.text}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div role="status" className="rounded-xl border border-dashed border-[#2b3b4e] px-4 py-12 text-center">
          <p className="text-sm font-semibold">No matching transcript lines found</p>
          <p className="mt-1 text-xs text-muted">Try adjusting your search query or speaker filter.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => { setQuery(""); setSpeaker("all"); setLimit(24); }}>Clear filters</Button>
        </div>
      )}
      {visible.length > shown.length && <div className="pt-4 text-center"><Button variant="secondary" size="sm" onClick={() => setLimit(limit + 24)}>Show more turns ({visible.length - shown.length} remaining)</Button></div>}
    </div>
  );
}

export function ActionItemsPanel({ meeting, doneIds, onToggle }: { meeting: Meeting; doneIds: string[]; onToggle: (id: string) => void }) {
  if (meeting.actions.length === 0) {
    return <PendingContent meeting={meeting} type="actions" />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">{meeting.actions.length} {meeting.isDemo ? "sample follow-ups" : "action items"}</p>
        <Button variant="secondary" size="sm" disabled title="Manual action item creation will be available in a future update"><Plus size={14} /> Add item</Button>
      </div>
      <div className="space-y-3">
        {meeting.actions.map((item) => {
          const done = meeting.isDemo ? doneIds.includes(item.id) : item.done;
          return (
            <div key={item.id} className="flex items-start gap-3 rounded-xl border border-[#2b3b4e] p-4">
              <button
                type="button"
                disabled={!meeting.isDemo}
                title={meeting.isDemo ? undefined : "Action item completion status is currently view-only"}
                aria-label={meeting.isDemo ? (done ? "Mark incomplete: " : "Mark complete: ") + item.text : (done ? "Completed: " : "Incomplete: ") + item.text}
                aria-pressed={done}
                onClick={meeting.isDemo ? () => onToggle(item.id) : undefined}
                className="mt-0.5 shrink-0 rounded-full text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {done ? <CheckCircle2 size={19} /> : <Circle size={19} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={"break-words text-[13px] font-semibold " + (done ? "text-[#77899f] line-through" : "text-ink")}>{item.text}</p>
                <p className="mt-2 text-[11px] text-muted">{item.owner} <span className="mx-1">·</span> {item.due === "No due date" ? item.due : "Due " + item.due}</p>
              </div>
            </div>
          );
        })}
      </div>
      {meeting.isDemo && <p className="mt-4 text-[11px] text-muted">Changes here are only visible until this page is refreshed.</p>}
    </div>
  );
}

export function CreateHighlightModal({
  open,
  onClose,
  initialData,
  meetingId,
  existingHighlights,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  initialData?: {
    title?: string;
    startTime?: number;
    endTime?: number;
    text?: string;
  };
  meetingId: string;
  existingHighlights: Highlight[];
  onCreated: (highlight: Highlight) => void;
}) {
  const [title, setTitle] = useState(initialData?.title || "Key moment");
  const [startTime, setStartTime] = useState<number>(initialData?.startTime ?? 0);
  const [endTime, setEndTime] = useState<number>(initialData?.endTime ?? 5);
  const [text, setText] = useState(initialData?.text || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(initialData?.title || "Key moment");
      const s = initialData?.startTime ?? 0;
      setStartTime(s);
      setEndTime(initialData?.endTime ?? (s + 5));
      setText(initialData?.text || "");
      setError(null);
    }
  }, [open, initialData]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Please provide a title for the highlight.");
      return;
    }
    if (endTime < startTime) {
      setError("End time cannot be earlier than start time.");
      return;
    }

    // Client-side duplicate check: match within 0.5s and same title, or same span for user highlights
    const isDuplicate = existingHighlights.some((h) => {
      const hStart = h.startTimeSec ?? 0;
      const hEnd = h.endTimeSec ?? hStart;
      const startMatches = Math.abs(hStart - startTime) < 0.5;
      const titleMatches = h.title.trim().toLowerCase() === cleanTitle.toLowerCase();
      const endMatches = Math.abs(hEnd - endTime) < 0.5;
      const isUser = h.source === "user";
      return (startMatches && titleMatches) || (isUser && startMatches && endMatches);
    });

    if (isDuplicate) {
      setError("A highlight with this title and timestamp already exists.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch(`/api/meetings/${meetingId}/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          startTime,
          endTime,
          text: text.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create highlight");
      }

      onCreated({
        id: data.highlight.id,
        title: data.highlight.title,
        time: formatTimestamp(startTime),
        endTime: endTime > startTime ? formatTimestamp(endTime) : undefined,
        kind: "User Highlight",
        startTimeSec: startTime,
        endTimeSec: endTime,
        text: text.trim(),
        source: "user",
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create highlight");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      title="Create highlight"
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="sm" type="button" onClick={() => handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save highlight"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg bg-rose-950/60 border border-rose-500/30 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#acbbcc] mb-1">Highlight title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Script review feedback"
            className="w-full rounded-lg border border-[#2b3b4e] bg-[#172333] px-3 py-2 text-xs text-white placeholder-muted focus:border-brand focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#acbbcc] mb-1">
              Start: <span className="font-mono text-brand">{formatTimestamp(startTime)}</span> ({startTime.toFixed(1)}s)
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={startTime}
              onChange={(e) => setStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full rounded-lg border border-[#2b3b4e] bg-[#172333] px-3 py-2 text-xs text-white font-mono focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#acbbcc] mb-1">
              End: <span className="font-mono text-brand">{formatTimestamp(endTime)}</span> ({endTime.toFixed(1)}s)
            </label>
            <input
              type="number"
              min={startTime}
              step="0.5"
              value={endTime}
              onChange={(e) => setEndTime(Math.max(startTime, parseFloat(e.target.value) || startTime))}
              className="w-full rounded-lg border border-[#2b3b4e] bg-[#172333] px-3 py-2 text-xs text-white font-mono focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#acbbcc] mb-1">Selected transcript text</label>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Selected transcript excerpt..."
            className="w-full rounded-lg border border-[#2b3b4e] bg-[#172333] px-3 py-2 text-xs text-white placeholder-muted focus:border-brand focus:outline-none resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}

export function HighlightsPanel({
  meeting,
  onSeek,
  onOpenCreate,
  onDeleteHighlight,
  onShareHighlight,
}: {
  meeting: Meeting;
  onSeek?: (timeSec: number) => void;
  onOpenCreate?: () => void;
  onDeleteHighlight?: (id: string) => void;
  onShareHighlight?: (highlight: Highlight) => void;
}) {
  const [filter, setFilter] = useState<"all" | "user" | "ai">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const highlights = meeting.highlights || [];
  const userHighlights = highlights.filter((h) => h.source === "user");
  const aiHighlights = highlights.filter((h) => h.source !== "user");

  if (highlights.length === 0 && meeting.isDemo) {
    return <PendingContent meeting={meeting} type="highlights" />;
  }

  async function handleDelete(id: string) {
    if (!onDeleteHighlight) return;
    try {
      setDeletingId(id);
      await onDeleteHighlight(id);
    } finally {
      setDeletingId(null);
    }
  }

  const renderHighlightCard = (item: Highlight, isUser: boolean) => (
    <div
      key={item.id}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        if (onSeek && item.startTimeSec !== undefined) onSeek(item.startTimeSec);
      }}
      className={`group flex min-w-0 flex-col gap-2 rounded-xl border border-[#2b3b4e] bg-[#121c29]/40 p-4 transition hover:border-[#38506a] hover:bg-[#152334]/60 ${
        onSeek && item.startTimeSec !== undefined ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              isUser ? "bg-amber-950/60 text-amber-300 border border-amber-500/30" : "bg-[#132b43] text-brand"
            }`}
          >
            <Bookmark size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-words text-[13px] font-bold text-white">{item.title}</p>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  isUser
                    ? "bg-amber-950/70 text-amber-300 border border-amber-500/30"
                    : "bg-[#1a2d42] text-[#8cb4db]"
                }`}
              >
                {item.kind}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onSeek && item.startTimeSec !== undefined ? (
            <button
              type="button"
              onClick={() => onSeek(item.startTimeSec!)}
              className="inline-flex items-center gap-1 rounded-lg bg-[#223247] px-2.5 py-1 text-[11px] font-semibold text-brand/90 transition hover:bg-[#2e425a] hover:text-brand"
              aria-label={`Seek to ${item.time}`}
              title={`Jump to ${item.time}`}
            >
              <Play size={10} fill="currentColor" />
              <span>{item.time}</span>
              {item.endTime && <span className="text-muted"> - {item.endTime}</span>}
            </button>
          ) : (
            <span className="shrink-0 rounded-lg bg-[#223247] px-2 py-1 text-[11px] font-semibold text-[#acbbcc]">{item.time}</span>
          )}

          {onShareHighlight && !meeting.isDemo && (
            <button
              type="button"
              onClick={() => onShareHighlight(item)}
              className="rounded-lg p-1.5 text-muted transition hover:bg-[#203043] hover:text-brand"
              title="Share this highlight"
              aria-label={`Share highlight: ${item.title}`}
            >
              <Share2 size={14} />
            </button>
          )}

          {isUser && onDeleteHighlight && (
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              disabled={deletingId === item.id}
              className="rounded-lg p-1.5 text-muted transition hover:bg-rose-950/50 hover:text-rose-400 disabled:opacity-50"
              title="Delete this highlight"
              aria-label={`Delete highlight: ${item.title}`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {item.text && (
        <div className="mt-1 rounded-lg border-l-2 border-brand/50 bg-[#0c131c]/60 px-3 py-2">
          <p className="text-xs italic leading-5 text-[#b0c0d4]">&ldquo;{item.text}&rdquo;</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header with filter tabs and Create highlight button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#253345] pb-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              filter === "all" ? "bg-brand text-white" : "bg-[#172333] text-muted hover:text-ink"
            }`}
          >
            All ({highlights.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("user")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              filter === "user" ? "bg-brand text-white" : "bg-[#172333] text-muted hover:text-ink"
            }`}
          >
            Your Highlights ({userHighlights.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("ai")}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              filter === "ai" ? "bg-brand text-white" : "bg-[#172333] text-muted hover:text-ink"
            }`}
          >
            AI Suggested ({aiHighlights.length})
          </button>
        </div>

        {onOpenCreate && !meeting.isDemo && (
          <Button variant="secondary" size="sm" onClick={onOpenCreate}>
            <Plus size={14} /> Create highlight
          </Button>
        )}
      </div>

      {/* Main content based on filter */}
      {filter === "all" && (
        <div className="space-y-6">
          {/* User highlights section */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                <Bookmark size={13} /> Your Highlights ({userHighlights.length})
              </h4>
            </div>
            {userHighlights.length > 0 ? (
              <div className="space-y-2.5">
                {userHighlights.map((item) => renderHighlightCard(item, true))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#2b3b4e] p-5 text-center text-xs text-muted">
                No custom highlights created yet. Click <span className="font-semibold text-brand">&ldquo;Highlight&rdquo;</span> on any transcript turn or use <span className="font-semibold text-brand">&ldquo;+ Create highlight&rdquo;</span> above.
              </div>
            )}
          </div>

          {/* AI suggested highlights section */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand/90 flex items-center gap-1.5">
                <Sparkles size={13} /> AI-Suggested Highlights ({aiHighlights.length})
              </h4>
            </div>
            {aiHighlights.length > 0 ? (
              <div className="space-y-2.5">
                {aiHighlights.map((item) => renderHighlightCard(item, false))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#2b3b4e] p-5 text-center text-xs text-muted">
                No AI-suggested highlights available for this meeting yet.
              </div>
            )}
          </div>
        </div>
      )}

      {filter === "user" && (
        <div>
          {userHighlights.length > 0 ? (
            <div className="space-y-2.5">
              {userHighlights.map((item) => renderHighlightCard(item, true))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#2b3b4e] p-8 text-center text-xs text-muted">
              <p className="font-semibold text-white">No user highlights yet</p>
              <p className="mt-1">Create a highlight from any moment in the transcript or click below.</p>
              {onOpenCreate && !meeting.isDemo && (
                <Button variant="secondary" size="sm" onClick={onOpenCreate} className="mt-3">
                  <Plus size={14} /> Create highlight
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {filter === "ai" && (
        <div>
          {aiHighlights.length > 0 ? (
            <div className="space-y-2.5">
              {aiHighlights.map((item) => renderHighlightCard(item, false))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#2b3b4e] p-8 text-center text-xs text-muted">
              No AI-suggested highlights found for this meeting.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ShareModal({
  meeting,
  open,
  onClose,
  initialHighlight,
  onShareUpdated,
}: {
  meeting: Meeting;
  open: boolean;
  onClose: () => void;
  initialHighlight?: Highlight | null;
  onShareUpdated?: (token?: string, highlightId?: string | null) => void;
}) {
  const isDemo = Boolean(meeting.isDemo);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(initialHighlight?.id || null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedHighlightId(initialHighlight?.id || null);
    setCopyState("idle");
    setErrorMessage(null);
  }, [initialHighlight, open]);

  const currentHighlight = meeting.highlights.find((h) => h.id === selectedHighlightId);
  const activeLink = (meeting.shareLinks || []).find((l) => {
    if (selectedHighlightId) {
      return l.is_active && l.highlightId === selectedHighlightId;
    } else {
      return l.is_active && !l.highlightId;
    }
  });

  const isAnyone = Boolean(activeLink?.token || (!selectedHighlightId && meeting.shareToken));
  const activeToken = activeLink?.token || (!selectedHighlightId ? meeting.shareToken : undefined);

  const previewPath = isDemo
    ? `/share/sample-${meeting.id}`
    : activeToken
      ? `/share/${activeToken}`
      : undefined;

  async function handleToggleAccess(newAccess: "anyone" | "only_me") {
    if (isDemo) return;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access: newAccess,
          highlightId: selectedHighlightId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update share settings");
      }

      if (newAccess === "anyone") {
        onShareUpdated?.(data.token, selectedHighlightId);
      } else {
        onShareUpdated?.(undefined, selectedHighlightId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error updating share access";
      setErrorMessage(msg);
    } finally {
      setIsUpdating(false);
    }
  }

  async function copyShareLink() {
    if (!previewPath) return;
    try {
      await navigator.clipboard.writeText(window.location.origin + previewPath);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 3000);
    } catch {
      setCopyState("failed");
    }
  }

  const modalTitle = isDemo
    ? "Share demo meeting"
    : selectedHighlightId
      ? `Share highlight: ${currentHighlight?.title || "Selected moment"}`
      : "Share meeting";

  return (
    <Modal
      title={modalTitle}
      open={open}
      onClose={onClose}
      footer={<Button variant="secondary" onClick={onClose}>Done</Button>}
    >
      {isDemo ? (
        <>
          <div className="rounded-xl bg-[#132b43] p-4 text-sm leading-6 text-[#d2dce8]">
            <p className="font-bold">Sample meeting preview</p>
            <p className="mt-1">
              This is a static sample meeting. The link opens a public preview page.
            </p>
          </div>
          <button
            type="button"
            onClick={copyShareLink}
            className="mt-4 flex w-full items-center justify-between rounded-xl border border-[#2b3b4e] px-3 py-2.5 text-left text-xs text-muted"
          >
            <span className="truncate">{previewPath}</span>
            {copyState === "copied" ? <Check size={15} className="text-[#6cd3a5]" /> : <Copy size={15} />}
          </button>
          <p role="status" className="mt-2 min-h-4 text-[11px] text-muted">
            {copyState === "copied" ? "Preview link copied." : copyState === "failed" ? "Copy failed." : ""}
          </p>
          <Link
            href={previewPath!}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand"
            onClick={onClose}
          >
            Open preview page <ChevronRight size={13} />
          </Link>
        </>
      ) : (
        <div className="space-y-4">
          {/* Target Selector (Whole Meeting vs Highlights) */}
          {meeting.highlights && meeting.highlights.length > 0 && (
            <div className="rounded-xl border border-[#23354b] bg-[#0c1421] p-3 text-xs">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                Share Target
              </label>
              <select
                value={selectedHighlightId || "meeting"}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedHighlightId(val === "meeting" ? null : val);
                  setCopyState("idle");
                  setErrorMessage(null);
                }}
                className="w-full rounded-lg border border-[#2b3d54] bg-[#121c2a] px-3 py-2 text-xs font-semibold text-white focus:border-brand focus:outline-none"
              >
                <option value="meeting">Entire Meeting ({meeting.title})</option>
                <optgroup label="Highlights">
                  {meeting.highlights.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.time} – {h.title}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {/* Access Control Options: Anyone with link vs Only me */}
          <div className="rounded-xl border border-[#23354b] bg-[#0c1421] p-3.5 text-xs space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">
              Access permissions
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => !isAnyone && handleToggleAccess("anyone")}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                  isAnyone
                    ? "border-brand bg-brand/10 text-white"
                    : "border-[#202f42] bg-[#101926] text-muted hover:border-[#2b415a] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-brand">
                  <Globe size={14} /> Anyone with link
                </div>
                <span className="text-[11px] leading-4 text-muted">
                  Public access. No login required.
                </span>
              </button>

              <button
                type="button"
                disabled={isUpdating}
                onClick={() => isAnyone && handleToggleAccess("only_me")}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                  !isAnyone
                    ? "border-amber-500/50 bg-amber-500/10 text-white"
                    : "border-[#202f42] bg-[#101926] text-muted hover:border-[#2b415a] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-400">
                  <Lock size={14} /> Only me
                </div>
                <span className="text-[11px] leading-4 text-muted">
                  Private. Links are revoked.
                </span>
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg bg-rose-950/50 border border-rose-500/30 p-2.5 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          {/* Link display & actions when active */}
          {isAnyone && previewPath ? (
            <div className="rounded-xl border border-[#22354a] bg-[#101926] p-4 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-brand flex items-center gap-1.5">
                  <Check size={14} className="text-[#6cd3a5]" /> Active secure link
                </span>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleToggleAccess("only_me")}
                  className="text-[11px] text-muted hover:text-rose-400 transition underline"
                >
                  Revoke link
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== "undefined" ? window.location.origin + previewPath : previewPath}
                  className="flex-1 rounded-lg border border-[#2b3d54] bg-[#0c1421] px-3 py-2 text-xs font-mono text-[#c8d6e5] focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={copyShareLink}
                  className="shrink-0 flex items-center gap-1"
                >
                  {copyState === "copied" ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copyState === "copied" ? "Copied!" : "Copy"}</span>
                </Button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted pt-1">
                <span>Opens directly without login</span>
                <Link
                  href={previewPath}
                  target="_blank"
                  className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                >
                  Open public page <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#23354b] p-4 text-center text-xs text-muted">
              <Lock size={18} className="mx-auto mb-1.5 text-muted/60" />
              <p className="font-semibold text-white">This content is private</p>
              <p className="mt-0.5 text-[11px]">Select &ldquo;Anyone with link&rdquo; above to generate a secure share link.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export const SharePreviewModal = ShareModal;

export function MeetingWorkspace({ meeting, playbackUrl, recordingMimeType }: { meeting: Meeting; playbackUrl?: string; recordingMimeType?: string }) {
  const [currentMeeting, setCurrentMeeting] = useState(meeting);
  const [tab, setTab] = useState("summary");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTargetHighlight, setShareTargetHighlight] = useState<Highlight | null>(null);
  const [meetingDuration, setMeetingDuration] = useState(meeting.duration);
  const [doneIds, setDoneIds] = useState<string[]>(meeting.actions.filter((item) => item.done).map((item) => item.id));

  function handleOpenShareMeeting() {
    setShareTargetHighlight(null);
    setShareOpen(true);
  }

  function handleOpenShareHighlight(highlight: Highlight) {
    setShareTargetHighlight(highlight);
    setShareOpen(true);
  }

  function handleShareUpdated(token?: string, highlightId?: string | null) {
    setCurrentMeeting((prev) => {
      let updatedLinks = prev.shareLinks ? [...prev.shareLinks] : [];
      if (!token) {
        // Set to Only me / Revoked
        updatedLinks = updatedLinks.map((l) => {
          if (highlightId ? l.highlightId === highlightId : !l.highlightId) {
            return { ...l, status: "revoked", is_active: false };
          }
          return l;
        });
        return {
          ...prev,
          shareToken: highlightId ? prev.shareToken : undefined,
          shareLinks: updatedLinks,
        };
      } else {
        // Activated
        const existingIdx = updatedLinks.findIndex((l) =>
          highlightId ? l.highlightId === highlightId : !l.highlightId
        );
        const newEntry = {
          id: "link-" + Date.now(),
          token,
          status: "active",
          is_active: true,
          highlightId: highlightId || null,
        };
        if (existingIdx >= 0) {
          updatedLinks[existingIdx] = { ...updatedLinks[existingIdx], ...newEntry };
        } else {
          updatedLinks.push(newEntry);
        }
        return {
          ...prev,
          shareToken: highlightId ? prev.shareToken : token,
          shareLinks: updatedLinks,
        };
      }
    });
  }
  const [isTranscribingLoading, setIsTranscribingLoading] = useState(false);
  const [isCheckingProgress, setIsCheckingProgress] = useState(false);
  const [isAnalyzingLoading, setIsAnalyzingLoading] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
  const [highlightInitialData, setHighlightInitialData] = useState<{
    title?: string;
    startTime?: number;
    endTime?: number;
    text?: string;
  } | undefined>(undefined);
  const mediaRef = useRef<HTMLMediaElement>(null);

  function handleOpenCreateHighlight(initial?: { title?: string; startTime?: number; endTime?: number; text?: string }) {
    setHighlightInitialData(initial);
    setIsHighlightModalOpen(true);
  }

  function handleHighlightCreated(newHighlight: Highlight) {
    setCurrentMeeting((prev) => ({
      ...prev,
      highlights: [newHighlight, ...prev.highlights.filter((h) => h.id !== newHighlight.id)],
    }));
  }

  async function handleHighlightDeleted(highlightId: string) {
    if (!currentMeeting.id || currentMeeting.isDemo) {
      setCurrentMeeting((prev) => ({
        ...prev,
        highlights: prev.highlights.filter((h) => h.id !== highlightId),
      }));
      return;
    }
    try {
      const res = await fetch(`/api/meetings/${currentMeeting.id}/highlights?highlightId=${highlightId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete highlight");
      }
      setCurrentMeeting((prev) => ({
        ...prev,
        highlights: prev.highlights.filter((h) => h.id !== highlightId),
      }));
    } catch (err) {
      console.error("Failed to delete highlight:", err);
    }
  }

  function seekTo(timeSec: number) {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = timeSec;
    el.play().catch(() => {});
    // Scroll the player into view
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function handleStartTranscription() {
    if (isTranscribingLoading || currentMeeting.isDemo) return;
    try {
      setIsTranscribingLoading(true);
      setTranscribeError(null);
      const res = await fetch(`/api/meetings/${currentMeeting.id}/transcribe`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to start transcription");
      }
      setCurrentMeeting((prev) => ({
        ...prev,
        status: "Transcribing",
        analysisStatus: "transcribing",
        sonioxJobId: data.jobId || prev.sonioxJobId,
      }));
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : "Failed to start transcription");
    } finally {
      setIsTranscribingLoading(false);
    }
  }

  async function handleCheckProgress() {
    if (isCheckingProgress || currentMeeting.isDemo) return;
    try {
      setIsCheckingProgress(true);
      setTranscribeError(null);
      const res = await fetch(`/api/meetings/${currentMeeting.id}/transcribe/complete`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to check transcription progress");
      }
      if (data.status === "analyzing" || data.success) {
        window.location.reload();
      } else {
        setTranscribeError(
          data.message || `Transcription is still in progress (${data.sonioxStatus || "processing"}).`
        );
      }
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : "Failed to check progress");
    } finally {
      setIsCheckingProgress(false);
    }
  }

  async function handleRunAnalysis() {
    if (isAnalyzingLoading || currentMeeting.isDemo) return;
    try {
      setIsAnalyzingLoading(true);
      setTranscribeError(null);
      const res = await fetch(`/api/meetings/${currentMeeting.id}/analyze`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze meeting");
      }
      window.location.reload();
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : "Failed to run AI analysis");
    } finally {
      setIsAnalyzingLoading(false);
    }
  }

  function toggleDone(id: string) {
    setDoneIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const handleDurationDetected = (durSec: number) => {
    if (durSec > 0 && (meetingDuration === "—" || !meetingDuration)) {
      setMeetingDuration(formatMeetingDuration(durSec));
    }
    // Asynchronously notify backend to persist duration in database if real meeting
    if (!currentMeeting.isDemo && currentMeeting.id && durSec > 0) {
      fetch("/api/recordings/duration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: currentMeeting.id, durationSeconds: durSec }),
      }).catch(() => {});
    }
  };

  const statusLower = currentMeeting.status?.toLowerCase();
  const badgeClasses =
    statusLower === "transcribing"
      ? "bg-purple-950/60 text-purple-300 border border-purple-500/30"
      : statusLower === "analyzing"
        ? "bg-indigo-950/60 text-indigo-300 border border-indigo-500/30"
        : statusLower === "ready" || statusLower === "completed"
          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
          : statusLower === "failed"
            ? "bg-rose-950/60 text-rose-300 border border-rose-500/30"
            : "bg-[#132b43] text-brand";

  return (
    <div className="fade-in min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <Link href="/my-calls" className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-brand"><ArrowLeft size={15} /> Back to My Calls</Link>
      </div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span suppressHydrationWarning>{currentMeeting.date}</span>
            <span>·</span>
            <span suppressHydrationWarning>{currentMeeting.time}</span>
            <span>·</span>
            <span>{meetingDuration}</span>
          </div>
          <h1 className="max-w-4xl break-words text-[21px] font-semibold leading-tight tracking-tight sm:text-[24px]">{currentMeeting.title}</h1>
          {!currentMeeting.isDemo && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span role="status" className={`inline-block rounded px-2 py-1 text-xs font-semibold ${badgeClasses}`}>
                {currentMeeting.status}
              </span>
              {(statusLower === "uploaded" || statusLower === "pending") && (
                <button
                  type="button"
                  onClick={handleStartTranscription}
                  disabled={isTranscribingLoading}
                  className="inline-flex items-center gap-1.5 rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                >
                  <Sparkles size={12} />
                  {isTranscribingLoading ? "Submitting to Soniox..." : "Transcribe"}
                </button>
              )}
              {statusLower === "transcribing" && (
                <button
                  type="button"
                  onClick={handleCheckProgress}
                  disabled={isCheckingProgress}
                  className="inline-flex items-center gap-1.5 rounded bg-[#223247] hover:bg-[#2e425a] px-2.5 py-1 text-xs font-semibold text-[#b8d0e8] transition disabled:opacity-60 border border-[#38506a]"
                >
                  <Sparkles size={12} />
                  {isCheckingProgress ? "Checking status..." : "Check progress"}
                </button>
              )}
              {statusLower === "analyzing" && (
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzingLoading}
                  className="inline-flex items-center gap-1.5 rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                >
                  <Sparkles size={12} />
                  {isAnalyzingLoading ? "Analyzing with OpenAI..." : "Run AI Analysis"}
                </button>
              )}
            </div>
          )}
          {transcribeError && (
            <p className="mt-1 text-xs text-rose-400">{transcribeError}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs text-muted">
            <ParticipantAvatars people={currentMeeting.attendees} maxVisible={4} />
            <span>{currentMeeting.attendees.length} participants</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            label={<><Download size={14} /> Export</>}
            items={[
              {
                label: meeting.isDemo
                  ? "Export transcript (demo only - coming in future step)"
                  : meeting.transcript.length > 0
                    ? "Export transcript (exporting coming in future step)"
                    : "Export transcript (transcription pending)",
                disabled: true,
              },
              {
                label: meeting.isDemo
                  ? "Export notes (demo only - coming in future step)"
                  : meeting.summaryAvailable
                    ? "Export notes (exporting coming in future step)"
                    : "Export notes (summary pending)",
                disabled: true,
              },
            ]}
          />
          <Button variant="secondary" size="sm" onClick={handleOpenShareMeeting}><Share2 size={15} /> Share</Button>
          <Dropdown
            label={<MoreHorizontal size={16} />}
            items={[
              { label: "Rename meeting (editing coming in future step)", disabled: true },
              { label: "Delete meeting (management coming in future step)", disabled: true }
            ]}
          />
        </div>
      </div>
      <div className="min-w-0 space-y-3">
          {playbackUrl ? (
            <RecordingPlayer ref={mediaRef} playbackUrl={playbackUrl} mimeType={recordingMimeType} onDurationDetected={handleDurationDetected} />
          ) : (
            <RecordingPlaceholder duration={meetingDuration} isDemo={meeting.isDemo} />
          )}
          <Card className="min-w-0 overflow-hidden">
            <div className="border-b border-[#253345] px-4 pt-3 sm:px-5">
              <Tabs idBase="meeting-content" label="Meeting content" value={tab} onChange={setTab} items={[
                { id: "summary", label: "Summary" },
                { id: "transcript", label: "Transcript" },
                { id: "actions", label: "Action items", count: currentMeeting.actions.length > 0 ? currentMeeting.actions.length : undefined },
                { id: "highlights", label: "Highlights", count: currentMeeting.highlights.length > 0 ? currentMeeting.highlights.length : undefined }
              ]} />
            </div>
            <div role="tabpanel" id="meeting-content-panel" aria-labelledby={"meeting-content-" + tab} className="p-4 sm:p-5">
              {tab === "summary" && <SummaryPanel meeting={currentMeeting} onTabChange={setTab} />}
              {tab === "transcript" && (
                <TranscriptPanel
                  meeting={currentMeeting}
                  onSeek={playbackUrl ? seekTo : undefined}
                  onHighlightTurn={(turn) =>
                    handleOpenCreateHighlight({
                      title: `Quote from ${turn.speaker}`,
                      startTime: turn.startTimeSec,
                      endTime: (turn.startTimeSec ?? 0) + 5,
                      text: turn.text,
                    })
                  }
                />
              )}
              {tab === "actions" && <ActionItemsPanel meeting={currentMeeting} doneIds={doneIds} onToggle={toggleDone} />}
              {tab === "highlights" && (
                <HighlightsPanel
                  meeting={currentMeeting}
                  onSeek={playbackUrl ? seekTo : undefined}
                  onOpenCreate={() => handleOpenCreateHighlight()}
                  onDeleteHighlight={handleHighlightDeleted}
                  onShareHighlight={handleOpenShareHighlight}
                />
              )}
            </div>
          </Card>
      </div>
      <ShareModal
        meeting={currentMeeting}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        initialHighlight={shareTargetHighlight}
        onShareUpdated={handleShareUpdated}
      />
      <CreateHighlightModal
        open={isHighlightModalOpen}
        onClose={() => setIsHighlightModalOpen(false)}
        initialData={highlightInitialData}
        meetingId={currentMeeting.id}
        existingHighlights={currentMeeting.highlights}
        onCreated={handleHighlightCreated}
      />
    </div>
  );
}
