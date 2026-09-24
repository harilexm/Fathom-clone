"use client";

import { useEffect, useState } from "react";
import { AtSign, ChartNoAxesColumnIncreasing, ChevronDown, ChevronLeft, ChevronRight, FileText, Lightbulb, Paperclip, Send, Sparkles, UsersRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { findMeeting } from "@/lib/sample-data";

const libraryPrompts = [
  { label: "Summarize my last 3 customer calls", icon: FileText, color: "text-[#b274ff]" },
  { label: "What are key next steps from Acme's calls?", icon: UsersRound, color: "text-[#368dff]" },
  { label: "Show recurring themes across my calls", icon: ChartNoAxesColumnIncreasing, color: "text-[#36d2a0]" },
  { label: "Draft a follow-up email for this meeting", icon: Lightbulb, color: "text-[#ffab40]" }
];
const meetingPrompts = [
  { label: "Summarize this meeting", icon: FileText, color: "text-[#b274ff]" },
  { label: "What are the next steps?", icon: UsersRound, color: "text-[#368dff]" },
  { label: "What themes came up?", icon: ChartNoAxesColumnIncreasing, color: "text-[#36d2a0]" },
  { label: "Draft a follow-up email", icon: Lightbulb, color: "text-[#ffab40]" }
];

export function AskFathomPanel({ collapsed, onToggle, toggleLabel = "Collapse Ask Fathom" }: { collapsed: boolean; onToggle: () => void; toggleLabel?: string }) {
  const pathname = usePathname();
  const meetingId = pathname.startsWith("/meeting/") ? decodeURIComponent(pathname.slice("/meeting/".length)) : "";
  const meeting = findMeeting(meetingId);
  const [context, setContext] = useState("my-calls");
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setContext(meeting ? "meeting" : "my-calls");
    setQuestion("");
    setSubmitted(false);
  }, [meetingId, meeting]);

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center rounded-tl-xl border-l border-[#1a2433] bg-[#0c1119]">
        <div className="flex h-[52px] w-full shrink-0 items-center justify-center">
          <button type="button" onClick={onToggle} aria-label="Expand Ask Fathom" title="Expand Ask Fathom" className="rounded-md p-1.5 text-[#a9b8cb] hover:bg-[#202c3a] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6794ff]"><ChevronLeft size={18} strokeWidth={1.5} /></button>
        </div>
      </div>
    );
  }

  const prompts = context === "meeting" ? meetingPrompts : libraryPrompts;
  return (
    <div className="flex h-full min-h-0 flex-col rounded-tl-xl border-l border-[#1a2433] bg-[#0c1119]">
      <div className="flex h-[52px] shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} strokeWidth={2} className="text-[#4b78ff]" />
          <h2 className="text-[15px] font-semibold text-[#f3f6fc]">Ask Fathom</h2>
        </div>
        <button type="button" onClick={onToggle} aria-label={toggleLabel} title={toggleLabel} className="rounded-md p-1.5 text-[#a9b8cb] hover:bg-[#202c3a] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6794ff]"><ChevronRight size={18} strokeWidth={1.5} /></button>
      </div>

      <div className="shrink-0 px-4 pt-2">
        <label htmlFor={"fathom-context-" + (meeting ? "meeting" : "library")} className="sr-only">Ask Fathom context</label>
        <div className="relative inline-block">
          <select
            id={"fathom-context-" + (meeting ? "meeting" : "library")}
            value={context}
            onChange={(event) => { setContext(event.target.value); setSubmitted(false); }}
            className="h-8 appearance-none truncate rounded-md bg-[#131b27] pl-3 pr-8 text-[12px] font-medium text-[#c0cce0] outline-none transition-colors hover:bg-[#1e2a39] hover:text-[#f3f6fc] focus-visible:ring-1 focus-visible:ring-[#4b83ff]"
          >
            <option value="my-calls">My Calls</option>
            {meeting && <option value="meeting">{meeting.title}</option>}
          </select>
          <ChevronDown size={12} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7b8da3]" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4">
        <div className="mt-auto flex flex-col items-end space-y-2 pb-3">
          {prompts.map((prompt) => (
            <button key={prompt.label} type="button" onClick={() => { setQuestion(prompt.label); setSubmitted(false); }} className="w-fit max-w-[95%] rounded-[14px] border border-[#1e2a3a] bg-[#0f1520] px-3.5 py-2 text-left text-[13px] font-medium text-[#e5ebf5] transition-colors hover:border-[#2c3d52] hover:bg-[#141c29] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4b83ff]">
              {prompt.label}
            </button>
          ))}
          {submitted && <p role="status" className="rounded-sm border border-[#2b4d6c] bg-[#12263a] p-1.5 text-[11px] leading-tight text-[#a9d2fb]">Preview only.</p>}
        </div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); if (question.trim()) setSubmitted(true); }} className="shrink-0 px-4 pb-4 pt-1">
        <div className="flex h-[96px] flex-col rounded-md border border-[#1e2a3a] bg-[#0f1520] p-3 focus-within:border-[#4b83ff]">
          <textarea aria-label="Ask Fathom" value={question} onChange={(event) => { setQuestion(event.target.value); setSubmitted(false); }} placeholder="Ask a question..." rows={2} className="min-h-0 w-full flex-1 resize-none bg-transparent text-[13px] leading-tight text-[#f1f5fb] placeholder:text-[#acbdd4] focus:outline-none" />
          <div className="flex items-center gap-3 text-[#bdd0eb]">
            <Paperclip size={16} aria-hidden="true" />
            <AtSign size={16} aria-hidden="true" />
            <button type="submit" disabled={!question.trim()} aria-label="Preview question" className="ml-auto flex h-8 w-8 items-center justify-center rounded border border-[#477bff] bg-[#205cf0] text-white hover:bg-[#3470ff] disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6794ff]"><Send size={14} /></button>
          </div>
        </div>
      </form>
    </div>
  );
}
