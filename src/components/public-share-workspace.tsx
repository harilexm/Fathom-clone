"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Bookmark,
  Clock,
  Play,
  CheckCircle2,
  Circle,
  FileText,
  ListOrdered,
  Lock,
  ArrowLeft,
  Share2,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { formatTimestamp } from "@/lib/meetings";
import type { Meeting, Highlight, TranscriptTurn, ActionItem } from "@/lib/sample-data";

/**
 * Public Notice for Revoked or Private Share Links
 */
export function RevokedShareLinkNotice() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-md surface border border-[#2b3b4e] rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Lock size={28} />
        </div>
        <h1 className="text-lg font-bold text-white">This link is private</h1>
        <p className="mt-2 text-xs leading-5 text-muted">
          The owner of this meeting has restricted access to &ldquo;Only me&rdquo; or revoked this share link.
        </p>
        <div className="mt-6 border-t border-[#202d3d] pt-5">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-brand/90"
          >
            Sign in to Fathom
          </Link>
          <div className="mt-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition"
            >
              <ArrowLeft size={13} /> Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Public Shared Highlight View
 * Shows ONLY the intended shared highlight content (video clip, quote, speaker, times, meeting title)
 */
export function PublicSharedHighlightWorkspace({
  meetingTitle,
  meetingDate,
  highlight,
  playbackUrl,
  recordingMimeType,
}: {
  meetingTitle: string;
  meetingDate: string;
  highlight: Highlight;
  playbackUrl?: string;
  recordingMimeType?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoaded = () => {
      if (highlight.startTimeSec && highlight.startTimeSec > 0) {
        video.currentTime = highlight.startTimeSec;
      }
    };
    video.addEventListener("loadedmetadata", handleLoaded);
    return () => video.removeEventListener("loadedmetadata", handleLoaded);
  }, [highlight.startTimeSec]);

  function handlePlayClip() {
    const video = videoRef.current;
    if (!video) return;
    if (highlight.startTimeSec && highlight.startTimeSec > 0) {
      video.currentTime = highlight.startTimeSec;
    }
    void video.play();
    setIsPlaying(true);
  }

  const durationSec =
    highlight.endTimeSec && highlight.startTimeSec
      ? Math.max(1, Math.round(highlight.endTimeSec - highlight.startTimeSec))
      : null;

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:px-8 sm:py-8 text-ink">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Top brand header */}
        <header className="flex items-center justify-between border-b border-[#202d3d] pb-4">
          <div className="flex items-center gap-3">
            <span className="text-[17px] font-black tracking-[.14em] text-white">
              FATHOM<span className="text-brand">.</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
              <Bookmark size={11} /> Shared Highlight
            </span>
          </div>
          <Link
            href="/login"
            className="rounded-lg border border-[#26374a] bg-[#141e2b] px-3 py-1.5 text-xs font-semibold text-muted hover:text-white transition"
          >
            Sign in
          </Link>
        </header>

        {/* Meeting & Highlight Header */}
        <div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Calendar size={13} /> {meetingDate}
            </span>
            <span>·</span>
            <span>From meeting:</span>
            <span className="font-medium text-[#c8d6e5]">{meetingTitle}</span>
          </div>
          <h1 className="mt-2 text-xl sm:text-2xl font-bold text-white tracking-tight">
            {highlight.title}
          </h1>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-[#192636] px-2.5 py-1 text-xs font-semibold text-brand">
              <Clock size={12} /> {highlight.time} {highlight.endTime ? `– ${highlight.endTime}` : ""}
            </span>
            {durationSec && (
              <span className="text-xs text-muted font-medium">({durationSec}s clip)</span>
            )}
            <span className="rounded-md bg-[#172230] px-2 py-0.5 text-[11px] font-medium text-muted">
              {highlight.source === "user" ? "User Highlight" : "AI Suggested"}
            </span>
          </div>
        </div>

        {/* Video Player */}
        <div className="relative overflow-hidden rounded-2xl border border-[#223347] bg-[#080d14] shadow-2xl">
          {playbackUrl ? (
            <div className="aspect-video w-full bg-black">
              <video
                ref={videoRef}
                src={playbackUrl}
                controls
                playsInline
                className="h-full w-full object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              >
                {recordingMimeType && <source src={playbackUrl} type={recordingMimeType} />}
                Your browser does not support HTML5 video playback.
              </video>
            </div>
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center p-6 text-center text-muted">
              <Bookmark size={36} className="text-brand/40 mb-2" />
              <p className="text-sm font-semibold text-white">Clip preview</p>
              <p className="mt-1 text-xs max-w-sm">
                Video playback is currently unavailable for this clip. Read the quote below.
              </p>
            </div>
          )}
        </div>

        {/* Highlight Quote Box */}
        {highlight.text && (
          <div className="surface rounded-2xl border border-[#26374a] p-6 shadow-xl">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
              <FileText size={13} className="text-brand" /> Spoken Excerpt
            </h2>
            <blockquote className="rounded-xl border-l-4 border-brand bg-[#111c2a] p-4 text-sm sm:text-base leading-relaxed text-[#dbe5f0] italic font-medium">
              &ldquo;{highlight.text}&rdquo;
            </blockquote>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-[#202d3d] pt-6 pb-12 flex flex-col sm:flex-row items-center justify-between text-xs text-muted gap-3">
          <p>Shared securely via Fathom Meeting Intelligence.</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  void navigator.clipboard.writeText(window.location.href);
                  alert("Link copied to clipboard!");
                }
              }}
              className="inline-flex items-center gap-1.5 hover:text-white transition"
            >
              <Share2 size={13} /> Copy link
            </button>
            <Link href="/login" className="inline-flex items-center gap-1 text-brand hover:underline font-semibold">
              Get Fathom <ExternalLink size={12} />
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

/**
 * Public Shared Meeting Workspace
 * Shows the full shared meeting content with read-only controls and interactive seeking.
 */
export function PublicSharedMeetingWorkspace({
  meeting,
  playbackUrl,
  recordingMimeType,
}: {
  meeting: Meeting;
  playbackUrl?: string;
  recordingMimeType?: string;
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "actions" | "highlights" | "transcript">("summary");
  const mediaRef = useRef<HTMLVideoElement>(null);

  function seekTo(timeSec?: number) {
    if (typeof timeSec !== "number" || !mediaRef.current) return;
    mediaRef.current.currentTime = Math.max(0, timeSec);
    void mediaRef.current.play().catch(() => {});
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:px-6 sm:py-8 text-ink">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[#202d3d] pb-4">
          <div className="flex items-center gap-3">
            <span className="text-[17px] font-black tracking-[.14em] text-white">
              FATHOM<span className="text-brand">.</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
              Public Meeting
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  void navigator.clipboard.writeText(window.location.href);
                  alert("Share link copied to clipboard!");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#223347] bg-[#121c29] px-3 py-1.5 text-xs font-semibold text-muted hover:text-white transition"
            >
              <Share2 size={13} /> Copy link
            </button>
            <Link
              href="/login"
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand/90 transition"
            >
              Sign in
            </Link>
          </div>
        </header>

        {/* Meeting metadata bar */}
        <div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>{meeting.date}</span>
            <span>·</span>
            <span>{meeting.duration}</span>
            {meeting.attendees && meeting.attendees.length > 0 && (
              <>
                <span>·</span>
                <span>{meeting.attendees.length} participants</span>
              </>
            )}
          </div>
          <h1 className="mt-1.5 text-xl sm:text-2xl font-bold text-white tracking-tight">
            {meeting.title}
          </h1>
        </div>

        {/* Main 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Video player */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-[#223347] bg-[#080d14] shadow-2xl">
              {playbackUrl ? (
                <div className="aspect-video w-full bg-black">
                  <video
                    ref={mediaRef}
                    src={playbackUrl}
                    controls
                    playsInline
                    className="h-full w-full object-contain"
                  >
                    {recordingMimeType && <source src={playbackUrl} type={recordingMimeType} />}
                    Your browser does not support HTML5 video.
                  </video>
                </div>
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center p-6 text-center text-muted">
                  <Play size={36} className="text-brand/40 mb-2" />
                  <p className="text-sm font-semibold text-white">Playback unavailable</p>
                  <p className="mt-1 text-xs max-w-sm">
                    No active recording stream is available for this shared link.
                  </p>
                </div>
              )}
            </div>

            {/* Quick seek helper text */}
            {playbackUrl && (
              <p className="text-[11px] text-muted text-center sm:text-left">
                💡 Click any timestamp in the Highlights or Transcript panel to seek the video.
              </p>
            )}
          </div>

          {/* Right Column: Tabbed Content Panel */}
          <div className="lg:col-span-5 surface rounded-2xl border border-[#223347] shadow-xl overflow-hidden flex flex-col min-h-[500px]">
            {/* Tabs header */}
            <div className="flex border-b border-[#202d3d] bg-[#0c1420] px-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "summary"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <Sparkles size={13} /> Summary
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("actions")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "actions"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <ListOrdered size={13} /> Action items ({meeting.actions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("highlights")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "highlights"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <Bookmark size={13} /> Highlights ({meeting.highlights.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("transcript")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
                  activeTab === "transcript"
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <FileText size={13} /> Transcript
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto max-h-[600px] space-y-4">
              {/* 1. Summary Tab */}
              {activeTab === "summary" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                      Executive Summary
                    </h3>
                    <p className="text-xs sm:text-sm leading-6 text-[#dbe5f0]">
                      {meeting.summary || "No executive summary available for this meeting."}
                    </p>
                  </div>
                  {meeting.overview && meeting.overview.length > 0 && (
                    <div className="border-t border-[#202d3d] pt-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2.5">
                        Key Points & Overview
                      </h3>
                      <ul className="space-y-2">
                        {meeting.overview.map((pt, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs leading-5 text-[#c8d6e5]">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Action Items Tab */}
              {activeTab === "actions" && (
                <div className="space-y-3">
                  {meeting.actions.length > 0 ? (
                    meeting.actions.map((act) => (
                      <div
                        key={act.id}
                        className="rounded-xl border border-[#223347] bg-[#101926] p-3 text-xs flex items-start gap-3"
                      >
                        <div className="mt-0.5 text-muted">
                          {act.done ? (
                            <CheckCircle2 size={16} className="text-[#6cd3a5]" />
                          ) : (
                            <Circle size={16} className="text-[#3b4e65]" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${act.done ? "line-through text-muted" : "text-ink"}`}>
                            {act.text}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
                            {act.owner && <span>Owner: {act.owner}</span>}
                            {act.due && <span>Due: {act.due}</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted text-center py-8">No action items for this meeting.</p>
                  )}
                </div>
              )}

              {/* 3. Highlights Tab */}
              {activeTab === "highlights" && (
                <div className="space-y-3">
                  {meeting.highlights.length > 0 ? (
                    meeting.highlights.map((hl) => (
                      <div
                        key={hl.id}
                        onClick={() => seekTo(hl.startTimeSec)}
                        className="group cursor-pointer rounded-xl border border-[#223347] bg-[#101926] p-3.5 transition hover:border-brand/40 hover:bg-[#132030]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-semibold text-white group-hover:text-brand transition">
                            {hl.title}
                          </h4>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              seekTo(hl.startTimeSec);
                            }}
                            className="shrink-0 inline-flex items-center gap-1 rounded-md bg-[#1d2b3c] px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-brand/20 transition"
                          >
                            <Clock size={11} /> {hl.time}
                          </button>
                        </div>
                        {hl.text && (
                          <blockquote className="mt-2 text-[11px] leading-5 text-muted italic line-clamp-2">
                            &ldquo;{hl.text}&rdquo;
                          </blockquote>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted text-center py-8">No highlights created for this meeting.</p>
                  )}
                </div>
              )}

              {/* 4. Transcript Tab */}
              {activeTab === "transcript" && (
                <div className="space-y-4">
                  {meeting.transcript.length > 0 ? (
                    meeting.transcript.map((turn) => (
                      <div key={turn.id} className="text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${turn.color || "bg-brand/20 text-brand"}`}>
                              {turn.initials || turn.speaker.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="font-semibold text-white">{turn.speaker}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => seekTo(turn.startTimeSec)}
                            className="rounded-md bg-[#192636] px-1.5 py-0.5 text-[10px] font-medium text-brand/80 hover:bg-[#23354b] hover:text-brand transition"
                          >
                            {turn.time}
                          </button>
                        </div>
                        <p className="pl-7 text-[#c8d6e5] leading-relaxed">{turn.text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted text-center py-8">No transcript segments available.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-[#202d3d] pt-6 pb-12 flex flex-col sm:flex-row items-center justify-between text-xs text-muted gap-3">
          <p>Shared securely via Fathom Meeting Intelligence.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="inline-flex items-center gap-1 text-brand hover:underline font-semibold">
              Get Fathom <ExternalLink size={12} />
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
