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
  ChevronRight,
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
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Search words spoken, titles, people, decisions, action items..."
            className="w-full rounded-xl border border-[#2b3e55] bg-[#0c1421] py-3 pl-10 pr-10 text-sm text-white placeholder-muted focus:border-brand focus:outline-none shadow-sm"
          />
          {inputVal && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-white transition"
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-xl bg-brand px-5 py-3 text-xs font-semibold text-white shadow-md hover:bg-brand/90 transition disabled:opacity-60"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Filter Tabs / Pills (visible when results exist or query is active) */}
      {searchedQuery && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#202f42] pb-3 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 font-semibold transition ${
              filter === "all"
                ? "bg-brand text-white shadow-sm"
                : "bg-[#131d2b] text-muted hover:text-white"
            }`}
          >
            All Results ({results.length})
          </button>
          {transcriptCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("transcript")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                filter === "transcript"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-[#131d2b] text-muted hover:text-white"
              }`}
            >
              <Clock size={12} /> Transcript ({transcriptCount})
            </button>
          )}
          {titleCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("title")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                filter === "title"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-[#131d2b] text-muted hover:text-white"
              }`}
            >
              <FileText size={12} /> Titles ({titleCount})
            </button>
          )}
          {participantCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("participant")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                filter === "participant"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-[#131d2b] text-muted hover:text-white"
              }`}
            >
              <Users size={12} /> Participants ({participantCount})
            </button>
          )}
          {summaryCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("summary")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                filter === "summary"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-[#131d2b] text-muted hover:text-white"
              }`}
            >
              <Sparkles size={12} /> Summary ({summaryCount})
            </button>
          )}
          {actionCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("action_item")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                filter === "action_item"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-[#131d2b] text-muted hover:text-white"
              }`}
            >
              <ListTodo size={12} /> Action items ({actionCount})
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
              const isTitle = item.matchType === "title";

              let badgeBg = "bg-brand/10 text-brand border-brand/20";
              let badgeIcon = <FileText size={11} />;
              let badgeLabel = "Meeting Title";

              if (isTranscript) {
                badgeBg = "bg-emerald-950/60 text-emerald-300 border-emerald-500/30";
                badgeIcon = <Clock size={11} />;
                badgeLabel = `Transcript · ${item.timestamp || "Moment"}`;
              } else if (isAction) {
                badgeBg = "bg-purple-950/60 text-purple-300 border-purple-500/30";
                badgeIcon = <ListTodo size={11} />;
                badgeLabel = "Action Item";
              } else if (isSummary) {
                badgeBg = "bg-indigo-950/60 text-indigo-300 border-indigo-500/30";
                badgeIcon = <Sparkles size={11} />;
                badgeLabel = "Summary";
              } else if (isParticipant) {
                badgeBg = "bg-amber-950/60 text-amber-300 border-amber-500/30";
                badgeIcon = <Users size={11} />;
                badgeLabel = "Participant";
              }

              return (
                <Link
                  key={item.id}
                  href={item.targetUrl}
                  className="group block rounded-xl border border-[#23354b] bg-[#0c1421] p-4 transition hover:border-brand/50 hover:bg-[#111c2c] shadow-sm"
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
                        <span className="text-xs font-semibold text-white group-hover:text-brand transition truncate">
                          {item.meetingTitle}
                        </span>
                        <span className="text-[11px] text-muted flex items-center gap-1">
                          <Calendar size={11} /> {item.meetingDate}
                        </span>
                      </div>

                      {/* Snippet text */}
                      <div className="text-xs leading-relaxed text-[#c8d6e5]">
                        {item.speaker && (
                          <span className="font-semibold text-white mr-1.5">
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
        <div className="rounded-2xl border border-dashed border-[#23354b] p-10 text-center space-y-2">
          <Search size={28} className="mx-auto text-muted/60 mb-2" />
          <h3 className="text-sm font-bold text-white">No matching results found</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            We couldn&apos;t find any meetings matching &ldquo;{searchedQuery}&rdquo;. Try searching for a different word, speaker name, or topic.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#202f42] bg-[#0c1421] p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Search size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Search Your Meetings</h3>
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
                className="rounded-lg border border-[#25394f] bg-[#121c29] px-2.5 py-1 text-xs text-muted hover:border-brand/40 hover:text-white transition"
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
