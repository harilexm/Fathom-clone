"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Clock,
  Sparkles,
  ListTodo,
  Users,
  FileText,
  X,
  Calendar,
  ArrowRight,
} from "lucide-react";
import type { SearchResultItem } from "@/app/api/search/route";

type FilterType = "all" | "transcript" | "title" | "participant" | "summary" | "action_item";

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  if (!query || !query.trim()) return <span>{text}</span>;

  const trimmedQuery = query.trim();
  const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark
            key={index}
            className="rounded bg-brand/30 px-1 py-0.5 font-semibold text-white text-inherit"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  );
}

export function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";

  const [inputVal, setInputVal] = useState(initialQuery);
  const [filter, setFilter] = useState<FilterType>("all");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState(initialQuery);
  const [, startTransition] = useTransition();

  const fetchResults = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearchedQuery("");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results || []);
      setSearchedQuery(trimmed);
    } catch (err) {
      console.error("Search error:", err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setInputVal(initialQuery);
    void fetchResults(initialQuery);
  }, [initialQuery, fetchResults]);

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputVal.trim();
    startTransition(() => {
      if (trimmed) {
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      } else {
        router.push("/search");
      }
    });
    void fetchResults(trimmed);
  }

  function handleClear() {
    setInputVal("");
    startTransition(() => {
      router.push("/search");
    });
    setResults([]);
    setSearchedQuery("");
  }

  // Filtered counts
  const transcriptCount = results.filter((r) => r.matchType === "transcript").length;
  const titleCount = results.filter((r) => r.matchType === "title").length;
  const participantCount = results.filter((r) => r.matchType === "participant").length;
  const summaryCount = results.filter((r) => r.matchType === "summary").length;
  const actionCount = results.filter((r) => r.matchType === "action_item").length;

  const filteredResults = results.filter((r) => {
    if (filter === "all") return true;
    return r.matchType === filter;
  });

  return (
    <div className="fade-in min-w-0 py-6 max-w-5xl mx-auto space-y-6">
      {/* Search Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Search Meetings
        </h1>
        <p className="mt-1 text-xs text-muted">
          Search across spoken transcripts, meeting titles, participants, summaries, and action items.
        </p>
      </div>

      {/* Search Bar Input */}
      <form onSubmit={handleFormSubmit} className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52637a] pointer-events-none"
          />
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Search words spoken, titles, people, decisions, action items..."
            className="w-full rounded-md border border-[#151e2b] bg-[#080c14] py-2.5 pl-9 pr-9 text-xs text-[#f1f5f9] placeholder:text-[#52637a] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]/20 transition-all"
          />
          {inputVal && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#64748b] hover:text-[#f1f5f9] transition-colors"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-[#2563eb] px-4 py-2.5 text-xs font-semibold text-white shadow-none hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Filter Tabs / Pills */}
      {searchedQuery && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#131b26] pb-3 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              filter === "all"
                ? "bg-[#0e1726] border border-[#1e3458] text-[#3b82f6]"
                : "bg-[#080c14] border border-[#151e2b] text-[#64748b] hover:text-[#cbd5e1] hover:border-[#1e2a3c]"
            }`}
          >
            All Results ({results.length})
          </button>
          {transcriptCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("transcript")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === "transcript"
                  ? "bg-[#051c14] border border-[#0d3b2b] text-[#34d399]"
                  : "bg-[#080c14] border border-[#151e2b] text-[#64748b] hover:text-[#cbd5e1] hover:border-[#1e2a3c]"
              }`}
            >
              <Clock size={11} /> Transcript ({transcriptCount})
            </button>
          )}
          {titleCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("title")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === "title"
                  ? "bg-[#0d172b] border border-[#162b4d] text-[#60a5fa]"
                  : "bg-[#080c14] border border-[#151e2b] text-[#64748b] hover:text-[#cbd5e1] hover:border-[#1e2a3c]"
              }`}
            >
              <FileText size={11} /> Titles ({titleCount})
            </button>
          )}
          {participantCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("participant")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === "participant"
                  ? "bg-[#1c140a] border border-[#3b2a15] text-amber-400"
                  : "bg-[#080c14] border border-[#151e2b] text-[#64748b] hover:text-[#cbd5e1] hover:border-[#1e2a3c]"
              }`}
            >
              <Users size={11} /> Participants ({participantCount})
            </button>
          )}
          {summaryCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("summary")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === "summary"
                  ? "bg-[#0e1726] border border-[#1e3458] text-[#3b82f6]"
                  : "bg-[#080c14] border border-[#151e2b] text-[#64748b] hover:text-[#cbd5e1] hover:border-[#1e2a3c]"
              }`}
            >
              <Sparkles size={11} /> Summary ({summaryCount})
            </button>
          )}
          {actionCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("action_item")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
                filter === "action_item"
                  ? "bg-[#14162e] border border-[#202758] text-[#818cf8]"
                  : "bg-[#080c14] border border-[#151e2b] text-[#64748b] hover:text-[#cbd5e1] hover:border-[#1e2a3c]"
              }`}
            >
              <ListTodo size={11} /> Action items ({actionCount})
            </button>
          )}
        </div>
      )}

      {/* Results List */}
      {isLoading ? (
        <div className="space-y-3 py-8 text-center text-xs text-muted">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p>Searching your meetings...</p>
        </div>
      ) : searchedQuery && filteredResults.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Found {filteredResults.length} matching {filteredResults.length === 1 ? "moment" : "moments"} for &ldquo;{searchedQuery}&rdquo;
          </p>

          <div className="space-y-2.5">
            {filteredResults.map((item) => {
              const isTranscript = item.matchType === "transcript";
              const isAction = item.matchType === "action_item";
              const isSummary = item.matchType === "summary";
              const isParticipant = item.matchType === "participant";

              let badgeBg = "bg-[#0c182b] text-[#60a5fa] border-[#1d3557]";
              let badgeIcon = <FileText size={11} />;
              let badgeLabel = "Meeting Title";

              if (isTranscript) {
                badgeBg = "bg-[#061a14] text-[#34d399] border-[#0c3629]";
                badgeIcon = <Clock size={11} />;
                badgeLabel = `Transcript · ${item.timestamp || "Moment"}`;
              } else if (isAction) {
                badgeBg = "bg-[#0c182b] text-[#93c5fd] border-[#1d3557]";
                badgeIcon = <ListTodo size={11} />;
                badgeLabel = "Action Item";
              } else if (isSummary) {
                badgeBg = "bg-[#0c182b] text-[#60a5fa] border-[#1d3557]";
                badgeIcon = <Sparkles size={11} />;
                badgeLabel = "Summary";
              } else if (isParticipant) {
                badgeBg = "bg-[#1c1708] text-[#fbbf24] border-[#3d3210]";
                badgeIcon = <Users size={11} />;
                badgeLabel = "Participant";
              }

              return (
                <Link
                  key={item.id}
                  href={item.targetUrl}
                  className="group block rounded-lg border border-[#131b26] bg-[#070a10] p-4 transition hover:border-[#1e2a3c] hover:bg-[#0a0f17] shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Top row: match badge & meeting title */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeBg}`}
                        >
                          {badgeIcon}
                          {badgeLabel}
                        </span>
                        <span className="text-xs font-semibold text-[#f1f5f9] group-hover:text-brand transition truncate">
                          {item.meetingTitle}
                        </span>
                        <span className="text-[11px] text-muted flex items-center gap-1">
                          <Calendar size={11} /> {item.meetingDate}
                        </span>
                      </div>

                      {/* Snippet text */}
                      <div className="text-xs leading-relaxed text-[#cbd5e1]">
                        {item.speaker && (
                          <span className="font-semibold text-[#f1f5f9] mr-1.5">
                            {item.speaker}:
                          </span>
                        )}
                        <HighlightedSnippet text={item.snippet} query={searchedQuery} />
                      </div>
                    </div>

                    {/* Right action indicator */}
                    <div className="shrink-0 flex items-center text-xs font-semibold text-muted group-hover:text-brand transition gap-1 mt-1">
                      <span className="hidden sm:inline text-[11px]">
                        {isTranscript ? "Jump to timestamp" : "Open context"}
                      </span>
                      <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : searchedQuery ? (
        <div className="rounded-lg border border-dashed border-[#151e2b] p-10 text-center space-y-2">
          <Search size={28} className="mx-auto text-muted/60 mb-2" />
          <h3 className="text-sm font-bold text-[#f1f5f9]">No matching results found</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            We couldn&apos;t find any meetings matching &ldquo;{searchedQuery}&rdquo;. Try searching for a different word, speaker name, or topic.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-[#131b26] bg-[#070a10] p-8 text-center space-y-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#0c182b] text-brand border border-[#1d3557]">
            <Search size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#f1f5f9]">Search Your Meetings</h3>
            <p className="text-xs text-muted max-w-md mx-auto">
              Find exact moments spoken in any call, look up participants, review summaries, or find assigned action items.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] text-muted">Try searching:</span>
            {["Zoom", "Danny", "COVID", "script", "update"].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setInputVal(example);
                  startTransition(() => {
                    router.push(`/search?q=${encodeURIComponent(example)}`);
                  });
                  void fetchResults(example);
                }}
                className="rounded-md border border-[#151e2b] bg-[#080c14] px-2.5 py-1 text-xs text-muted hover:border-[#1e2a3c] hover:text-[#f1f5f9] transition"
              >
                &ldquo;{example}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
