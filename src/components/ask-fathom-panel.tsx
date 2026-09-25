"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  Bot,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Lightbulb,
  Paperclip,
  RotateCcw,
  Send,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { findMeeting } from "@/lib/sample-data";

export interface AskSourceReference {
  meetingId: string;
  meetingTitle: string;
  meetingDate?: string;
  type: "summary" | "action_item" | "highlight" | "transcript";
  snippet?: string;
  timestamp?: string;
  speaker?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AskSourceReference[];
  provider?: "openai" | "anthropic" | "grounded-notice";
  isStreaming?: boolean;
  error?: boolean;
}

interface ProcessedMeetingOption {
  id: string;
  title: string;
  status: string;
  date?: string;
}

const libraryPrompts = [
  { label: "Summarize my last 3 customer calls", icon: FileText, color: "text-[#b274ff]" },
  { label: "What are key next steps from Acme's calls?", icon: UsersRound, color: "text-[#368dff]" },
  { label: "Show recurring themes across my calls", icon: ChartNoAxesColumnIncreasing, color: "text-[#36d2a0]" },
  { label: "Draft a follow-up email from recent calls", icon: Lightbulb, color: "text-[#ffab40]" },
];

const meetingPrompts = [
  { label: "Summarize this meeting", icon: FileText, color: "text-[#b274ff]" },
  { label: "What are the next steps?", icon: UsersRound, color: "text-[#368dff]" },
  { label: "What themes came up?", icon: ChartNoAxesColumnIncreasing, color: "text-[#36d2a0]" },
  { label: "Draft a follow-up email", icon: Lightbulb, color: "text-[#ffab40]" },
];

/**
 * Lightweight, zero-dependency Markdown renderer.
 * Formats paragraphs, bullet lists, numbered lists, bold text, inline code, and quotes.
 */
function MarkdownContent({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushList = () => {
    if (!currentList) return;
    if (currentList.type === "ul") {
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-2 ml-4 list-disc space-y-1 text-[#d8e3f2]">
          {currentList.items.map((item, i) => (
            <li key={i}>{formatInline(item)}</li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol key={`ol-${elements.length}`} className="my-2 ml-4 list-decimal space-y-1 text-[#d8e3f2]">
          {currentList.items.map((item, i) => (
            <li key={i}>{formatInline(item)}</li>
          ))}
        </ol>
      );
    }
    currentList = null;
  };

  const formatInline = (text: string): React.ReactNode => {
    // Split by bold (**text**) and code (`code`)
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={i} className="rounded bg-[#1a2436] px-1 py-0.5 font-mono text-[11px] text-[#7badff]">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // Unordered bullet
    if (/^[-*•]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*•]\s+/, "");
      if (currentList && currentList.type === "ul") {
        currentList.items.push(itemText);
      } else {
        flushList();
        currentList = { type: "ul", items: [itemText] };
      }
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      const itemText = numMatch[2];
      if (currentList && currentList.type === "ol") {
        currentList.items.push(itemText);
      } else {
        flushList();
        currentList = { type: "ol", items: [itemText] };
      }
      continue;
    }

    // Regular line / header / quote
    flushList();

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="mt-3 mb-1 text-[13px] font-bold text-[#f1f5fb]">
          {formatInline(trimmed.slice(4))}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="mt-3.5 mb-1.5 text-[14px] font-bold text-white">
          {formatInline(trimmed.slice(3))}
        </h3>
      );
    } else if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="my-2 border-l-2 border-[#3b82f6] pl-3 italic text-[#9bb3d3]">
          {formatInline(trimmed.slice(2))}
        </blockquote>
      );
    } else {
      elements.push(
        <p key={i} className="my-1.5 leading-relaxed text-[#d6e2f4]">
          {formatInline(trimmed)}
        </p>
      );
    }
  }

  flushList();

  return <div className="space-y-1">{elements}</div>;
}

export function AskFathomPanel({
  collapsed,
  onToggle,
  toggleLabel = "Collapse Ask Fathom",
}: {
  collapsed: boolean;
  onToggle: () => void;
  toggleLabel?: string;
}) {
  const pathname = usePathname();
  const routeMeetingId = pathname.startsWith("/meeting/")
    ? decodeURIComponent(pathname.slice("/meeting/".length))
    : "";

  // Available processed meetings list fetched from /api/ask
  const [processedMeetings, setProcessedMeetings] = useState<ProcessedMeetingOption[]>([]);
  const [currentMeetingTitle, setCurrentMeetingTitle] = useState<string>("");

  // Selected scope: "my-calls" OR meetingId
  // Rule: On My Calls, default to My Calls. Inside a meeting, default to that meeting.
  const [selectedScope, setSelectedScope] = useState<string>(routeMeetingId || "my-calls");

  // Keep separate chat history for My Calls and each individual meeting
  // Key format: "my-calls" or "meeting:<meetingId>"
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});

  const [question, setQuestion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active scope key for message thread
  const activeScopeKey = selectedScope === "my-calls" ? "my-calls" : `meeting:${selectedScope}`;
  const currentMessages = useMemo(
    () => chatHistories[activeScopeKey] || [],
    [chatHistories, activeScopeKey]
  );

  // 1. Fetch user's processed meetings from /api/ask
  useEffect(() => {
    let isMounted = true;
    async function loadProcessedMeetings() {
      try {
        const res = await fetch("/api/ask");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.processedMeetings)) {
            setProcessedMeetings(data.processedMeetings);
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadProcessedMeetings();
    return () => {
      isMounted = false;
    };
  }, [pathname]);

  // 2. Resolve meeting title if inside a meeting
  useEffect(() => {
    if (!routeMeetingId) {
      setCurrentMeetingTitle("");
      return;
    }

    // Sample data check
    const sample = findMeeting(routeMeetingId);
    if (sample) {
      setCurrentMeetingTitle(sample.title);
      return;
    }

    // Processed list check
    const inProcessed = processedMeetings.find((m) => m.id === routeMeetingId);
    if (inProcessed) {
      setCurrentMeetingTitle(inProcessed.title);
      return;
    }

    // Fetch meeting details from /api/meetings/[id]
    let isMounted = true;
    fetch(`/api/meetings/${encodeURIComponent(routeMeetingId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (isMounted && data?.meeting?.title) {
          setCurrentMeetingTitle(data.meeting.title);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [routeMeetingId, processedMeetings]);

  // 3. Rule: On My Calls, default to My Calls. Inside a meeting, default to that meeting.
  useEffect(() => {
    if (routeMeetingId) {
      setSelectedScope(routeMeetingId);
    } else {
      setSelectedScope("my-calls");
    }
  }, [routeMeetingId]);

  // Auto-scroll chat to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, scrollToBottom]);

  // Handle scope dropdown change
  const handleScopeChange = (newScope: string) => {
    setSelectedScope(newScope);
    setQuestion("");
    // Give focus back to textarea
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // Clear current scope's chat history
  const handleClearChat = () => {
    setChatHistories((prev) => ({
      ...prev,
      [activeScopeKey]: [],
    }));
  };

  // Copy assistant response
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle sources accordion
  const toggleSourceExpand = (messageId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  // Submit question and stream response
  const handleSubmitQuestion = async (queryText: string) => {
    const cleanText = queryText.trim();
    if (!cleanText || isStreaming) return;

    const userMessageId = "user-" + Date.now();
    const assistantMessageId = "assistant-" + (Date.now() + 1);

    const userMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: cleanText,
    };

    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    const currentThread = chatHistories[activeScopeKey] || [];
    const updatedThread = [...currentThread, userMessage, assistantMessage];

    setChatHistories((prev) => ({
      ...prev,
      [activeScopeKey]: updatedThread,
    }));

    setQuestion("");
    setIsStreaming(true);

    try {
      const isMeetingScope = selectedScope !== "my-calls";
      const payload = {
        scope: isMeetingScope ? "meeting" : "my-calls",
        meetingId: isMeetingScope ? selectedScope : undefined,
        question: cleanText,
        history: currentThread.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      };

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errMessage = `Error ${res.status}`;
        try {
          const errData = await res.json();
          errMessage = errData.error || errMessage;
        } catch {}
        throw new Error(errMessage);
      }

      if (!res.body) {
        throw new Error("No response stream available");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      let responseSources: AskSourceReference[] = [];
      let responseProvider: "openai" | "anthropic" | "grounded-notice" = "openai";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith("event: metadata")) {
            const nextLine = lines[i + 1]?.trim() || "";
            if (nextLine.startsWith("data:")) {
              try {
                const meta = JSON.parse(nextLine.slice(5).trim());
                if (meta.sources) responseSources = meta.sources;
                if (meta.provider) responseProvider = meta.provider;
              } catch {}
            }
          } else if (line.startsWith("event: chunk")) {
            const nextLine = lines[i + 1]?.trim() || "";
            if (nextLine.startsWith("data:")) {
              try {
                const data = JSON.parse(nextLine.slice(5).trim());
                if (data.text) {
                  accumulatedText += data.text;
                  setChatHistories((prev) => {
                    const thread = prev[activeScopeKey] || [];
                    return {
                      ...prev,
                      [activeScopeKey]: thread.map((m) =>
                        m.id === assistantMessageId
                          ? {
                              ...m,
                              content: accumulatedText,
                              sources: responseSources,
                              provider: responseProvider,
                            }
                          : m
                      ),
                    };
                  });
                }
              } catch {}
            }
          } else if (line.startsWith("event: done")) {
            const nextLine = lines[i + 1]?.trim() || "";
            if (nextLine.startsWith("data:")) {
              try {
                const doneData = JSON.parse(nextLine.slice(5).trim());
                if (doneData.fullText) accumulatedText = doneData.fullText;
                if (doneData.provider) responseProvider = doneData.provider;
              } catch {}
            }
          } else if (line.startsWith("event: error")) {
            const nextLine = lines[i + 1]?.trim() || "";
            if (nextLine.startsWith("data:")) {
              try {
                const errData = JSON.parse(nextLine.slice(5).trim());
                throw new Error(errData.error || "Streaming error");
              } catch (e) {
                if (e instanceof Error && e.message !== "Streaming error") throw e;
              }
            }
          }
        }
      }

      // Mark streaming complete
      setChatHistories((prev) => {
        const thread = prev[activeScopeKey] || [];
        return {
          ...prev,
          [activeScopeKey]: thread.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: accumulatedText || m.content || "No response generated.",
                  isStreaming: false,
                  sources: responseSources,
                  provider: responseProvider,
                }
              : m
          ),
        };
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to retrieve response";
      setChatHistories((prev) => {
        const thread = prev[activeScopeKey] || [];
        return {
          ...prev,
          [activeScopeKey]: thread.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: `⚠️ ${errorMessage}`,
                  isStreaming: false,
                  error: true,
                }
              : m
          ),
        };
      });
    } finally {
      setIsStreaming(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center rounded-tl-xl border-l border-[#1a2433] bg-[#0c1119]">
        <div className="flex h-[52px] w-full shrink-0 items-center justify-center">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand Ask Fathom"
            title="Expand Ask Fathom"
            className="rounded-md p-1.5 text-[#a9b8cb] hover:bg-[#202c3a] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6794ff]"
          >
            <ChevronLeft size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    );
  }

  const isMeetingScope = selectedScope !== "my-calls";
  const prompts = isMeetingScope ? meetingPrompts : libraryPrompts;

  // Selected meeting label
  const selectedMeetingObj = processedMeetings.find((m) => m.id === selectedScope);
  const scopeTitle = isMeetingScope
    ? selectedMeetingObj?.title || currentMeetingTitle || "Current Meeting"
    : "My Calls";

  return (
    <div className="flex h-full min-h-0 flex-col rounded-tl-xl border-l border-[#1a2433] bg-[#0c1119]">
      {/* Header */}
      <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#151e2c] px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#162744] text-[#4b78ff]">
            <Sparkles size={14} strokeWidth={2.2} />
          </div>
          <h2 className="text-[14px] font-semibold text-[#f3f6fc]">Ask Fathom</h2>
          <span className="rounded bg-[#131c2a] px-1.5 py-0.5 text-[10px] font-medium text-[#7fa5dd]">
            0 credits
          </span>
        </div>
        <div className="flex items-center gap-1">
          {currentMessages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              aria-label="Reset chat for this scope"
              title="Reset conversation"
              className="rounded-md p-1.5 text-[#7b8da3] transition-colors hover:bg-[#1a2434] hover:text-white"
            >
              <RotateCcw size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-label={toggleLabel}
            title={toggleLabel}
            className="rounded-md p-1.5 text-[#a9b8cb] hover:bg-[#202c3a] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6794ff]"
          >
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Scope Selector Bar */}
      <div className="shrink-0 border-b border-[#151e2c] bg-[#090d14] px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="fathom-scope-select" className="sr-only">
            Ask Fathom Scope
          </label>
          <div className="relative inline-block w-full">
            <select
              id="fathom-scope-select"
              value={selectedScope}
              onChange={(e) => handleScopeChange(e.target.value)}
              className="h-8 w-full appearance-none truncate rounded-md border border-[#1e2a3a] bg-[#101724] pl-3 pr-8 text-[12px] font-medium text-[#c0cce0] outline-none transition-colors hover:border-[#2d3e54] hover:text-[#f3f6fc] focus-visible:ring-1 focus-visible:ring-[#4b83ff]"
            >
              <option value="my-calls">My Calls (Search all calls)</option>
              {/* If on a meeting page, show current meeting first */}
              {routeMeetingId && (
                <option value={routeMeetingId}>
                  Meeting: {currentMeetingTitle || "Current Meeting"}
                </option>
              )}
              {/* Other processed meetings */}
              {processedMeetings
                .filter((m) => m.id !== routeMeetingId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    Meeting: {m.title}
                  </option>
                ))}
            </select>
            <ChevronDown
              size={13}
              aria-hidden="true"
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7b8da3]"
            />
          </div>
        </div>
        <p className="mt-1 text-[11px] text-[#71849d] truncate">
          {isMeetingScope
            ? `Scoped strictly to "${scopeTitle}"`
            : "Searching relevant context across your processed calls"}
        </p>
      </div>

      {/* Chat Messages Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
        {currentMessages.length === 0 ? (
          /* Empty State: Show suggested prompt chips */
          <div className="mt-auto flex flex-col items-end space-y-2 pb-2">
            <p className="w-full text-left text-[11px] font-medium uppercase tracking-wider text-[#637792]">
              Suggested Prompts
            </p>
            {prompts.map((prompt) => {
              const Icon = prompt.icon;
              return (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => handleSubmitQuestion(prompt.label)}
                  disabled={isStreaming}
                  className="group flex w-fit max-w-[95%] items-center gap-2 rounded-[14px] border border-[#1e2a3a] bg-[#0f1520] px-3.5 py-2 text-left text-[12.5px] font-medium text-[#d9e3f2] transition-colors hover:border-[#33465e] hover:bg-[#141d2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4b83ff]"
                >
                  <Icon size={14} className={prompt.color + " shrink-0"} />
                  <span>{prompt.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Conversation Thread */
          <div className="space-y-4 pb-2">
            {currentMessages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.role === "user"
                    ? "flex justify-end"
                    : "flex flex-col items-start"
                }
              >
                {msg.role === "user" ? (
                  <div className="max-w-[88%] rounded-2xl rounded-tr-sm border border-[#2b446a] bg-[#182944] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#f0f5fc]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="w-full rounded-2xl rounded-tl-sm border border-[#1a2536] bg-[#0f1623] p-3.5 text-[13px] text-[#e0e8f5]">
                    {/* Assistant Header */}
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#7fa5dd]">
                        <Bot size={13} className="text-[#4b78ff]" />
                        <span>Fathom AI</span>
                        {msg.provider && (
                          <span className="ml-1 rounded bg-[#141d2b] px-1.5 py-0.2 font-mono text-[9.5px] text-[#869cb8]">
                            {msg.provider === "grounded-notice"
                              ? "status"
                              : msg.provider === "anthropic"
                              ? "anthropic fallback"
                              : "openai"}
                          </span>
                        )}
                      </div>
                      {!msg.isStreaming && msg.content && (
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          title="Copy answer"
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[#71859e] hover:bg-[#182333] hover:text-[#c4d6ee]"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check size={11} className="text-[#36d2a0]" />
                              <span className="text-[#36d2a0]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Assistant Message Body */}
                    {msg.isStreaming && !msg.content ? (
                      <div className="flex items-center gap-2 py-1 text-[12px] text-[#8ea4c2]">
                        <Sparkles size={14} className="animate-spin text-[#4b78ff]" />
                        <span>
                          {isMeetingScope
                            ? "Analyzing meeting transcript & summary..."
                            : "Searching processed calls & retrieving relevant context..."}
                        </span>
                      </div>
                    ) : (
                      <MarkdownContent content={msg.content} />
                    )}

                    {/* Streaming Cursor */}
                    {msg.isStreaming && msg.content && (
                      <span className="inline-block h-3.5 w-1.5 animate-pulse bg-[#4b83ff] align-middle" />
                    )}

                    {/* Grounded Sources & Citations */}
                    {!msg.isStreaming && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 border-t border-[#182335] pt-2">
                        <button
                          type="button"
                          onClick={() => toggleSourceExpand(msg.id)}
                          className="flex items-center gap-1.5 text-[11px] font-medium text-[#768da7] hover:text-[#adc3df]"
                        >
                          <ChevronDown
                            size={12}
                            className={
                              "transition-transform " +
                              (expandedSources[msg.id] ? "rotate-180" : "")
                            }
                          />
                          <span>
                            {msg.sources.length}{" "}
                            {msg.sources.length === 1 ? "source referenced" : "sources referenced"}
                          </span>
                        </button>

                        {expandedSources[msg.id] && (
                          <div className="mt-2 space-y-1.5">
                            {msg.sources.map((src, idx) => (
                              <div
                                key={idx}
                                className="rounded border border-[#192434] bg-[#0c121d] p-2 text-[11px] text-[#93a7c0]"
                              >
                                <div className="flex items-center justify-between font-semibold text-[#c8d8ec]">
                                  <span>{src.meetingTitle}</span>
                                  {src.timestamp && (
                                    <span className="font-mono text-[10px] text-[#5b87d4]">
                                      {src.timestamp}
                                    </span>
                                  )}
                                </div>
                                {src.snippet && (
                                  <p className="mt-1 line-clamp-2 text-[#7f93ac]">
                                    {src.snippet}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmitQuestion(question);
        }}
        className="shrink-0 px-4 pb-4 pt-1"
      >
        <div className="flex h-[96px] flex-col rounded-md border border-[#1e2a3a] bg-[#0f1520] p-3 focus-within:border-[#4b83ff]">
          <textarea
            ref={textareaRef}
            aria-label="Ask Fathom"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmitQuestion(question);
              }
            }}
            disabled={isStreaming}
            placeholder={
              isMeetingScope
                ? "Ask a question about this call..."
                : "Ask anything across your processed calls..."
            }
            rows={2}
            className="min-h-0 w-full flex-1 resize-none bg-transparent text-[13px] leading-tight text-[#f1f5fb] placeholder:text-[#8b9db5] focus:outline-none disabled:opacity-50"
          />
          <div className="flex items-center gap-3 text-[#bdd0eb]">
            <Paperclip size={16} aria-hidden="true" className="opacity-60" />
            <AtSign size={16} aria-hidden="true" className="opacity-60" />
            <button
              type="submit"
              disabled={!question.trim() || isStreaming}
              aria-label="Send question"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded border border-[#477bff] bg-[#205cf0] text-white hover:bg-[#3470ff] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6794ff]"
            >
              {isStreaming ? (
                <Sparkles size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
