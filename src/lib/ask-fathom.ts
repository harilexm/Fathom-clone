/**
 * Ask Fathom server-side engine.
 * Supports two scopes:
 * 1. "meeting": Uses ONLY that specific processed meeting's transcript, summary,
 *    actions, decisions/topics, and highlights.
 * 2. "my-calls": Searches ONLY the authenticated user's processed meetings and
 *    retrieves ONLY the most relevant meeting/transcript context instead of
 *    sending every transcript.
 *
 * LLM Strategy: OpenAI primary, fallback to Anthropic only if OpenAI fails.
 * Streaming: Streams token chunks to client via Server-Sent Events (SSE).
 * Credits: Ask Fathom text chat uses 0 credits.
 * Grounding: Strictly grounded in meeting context; never fabricates answers.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMeeting, type Meeting } from "@/lib/sample-data";
import { getOpenAiApiKey, getOpenAiAnalysisModel } from "@/lib/openai";
import { getAnthropicApiKey, getAnthropicChatModel, isAnthropicConfigured } from "@/lib/anthropic";

export type AskScope = "my-calls" | "meeting";

export interface AskMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AskSourceReference {
  meetingId: string;
  meetingTitle: string;
  meetingDate?: string;
  type: "summary" | "action_item" | "highlight" | "transcript";
  snippet?: string;
  timestamp?: string;
  speaker?: string;
}

export interface AskFathomParams {
  scope: AskScope;
  meetingId?: string;
  question: string;
  history?: AskMessage[];
  user: { id: string; email?: string | null };
  supabase: SupabaseClient;
  onChunk?: (text: string) => void;
  simulateOpenAiFailure?: boolean;
}

export interface AskFathomResult {
  answer: string;
  scope: AskScope;
  meetingId?: string;
  meetingTitle?: string;
  sources: AskSourceReference[];
  relevantMeetingCount?: number;
  provider: "openai" | "anthropic" | "grounded-notice";
}

const OPENAI_API_BASE = "https://api.openai.com/v1";

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
  "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
  "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
  "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
  "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
  "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it",
  "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
  "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or",
  "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
  "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
  "some", "such", "than", "that", "that's", "the", "their", "theirs", "them",
  "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll",
  "they're", "they've", "this", "those", "through", "to", "too", "under", "until",
  "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
  "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
  "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
  "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
  "yourself", "yourselves", "call", "calls", "meeting", "meetings", "show", "tell",
  "give", "summarize", "summary", "across", "fathom", "ask"
]);

function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function detectRecencyCount(query: string): number | null {
  const match = query.match(/\b(?:last|past|previous)\s+(\d+)\s+(?:calls?|meetings?)\b/i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (!Number.isNaN(num) && num > 0) return Math.min(num, 10);
  }
  if (/\b(?:last|latest|most recent)\s+(?:call|meeting)\b/i.test(query)) {
    return 1;
  }
  if (/\b(?:recent|latest)\s+(?:calls|meetings)\b/i.test(query)) {
    return 3;
  }
  return null;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");
  return hrs > 0 ? `${hrs}:${String(mins).padStart(2, "0")}:${secs}` : `${mins}:${secs}`;
}

/**
 * Executes LLM chat stream:
 * 1. Primary: OpenAI with SSE streaming.
 * 2. Fallback: Anthropic only if OpenAI fails before streaming tokens.
 */
async function streamLlmWithFallback({
  systemPrompt,
  userPrompt,
  history = [],
  onChunk,
  simulateOpenAiFailure = false,
}: {
  systemPrompt: string;
  userPrompt: string;
  history?: AskMessage[];
  onChunk?: (text: string) => void;
  simulateOpenAiFailure?: boolean;
}): Promise<{ fullText: string; provider: "openai" | "anthropic" }> {
  let openAiError: Error | null = null;
  let tokensYielded = 0;
  let fullText = "";

  // 1. Attempt OpenAI Primary
  try {
    if (simulateOpenAiFailure) {
      throw new Error("Simulated OpenAI failure for fallback testing");
    }
    const apiKey = getOpenAiApiKey();
    const model = getOpenAiAnalysisModel();

    const messages = [
      { role: "system", content: systemPrompt },
      ...history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userPrompt },
    ];

    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_completion_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI HTTP ${response.status}: ${errText}`);
    }

    if (!response.body) {
      throw new Error("OpenAI returned no response stream body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr);
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (chunk) {
            tokensYielded++;
            fullText += chunk;
            if (onChunk) onChunk(chunk);
          }
        } catch {
          // ignore malformed SSE json lines
        }
      }
    }

    if (tokensYielded > 0 && fullText.trim()) {
      return { fullText: fullText.trim(), provider: "openai" };
    }

    throw new Error("OpenAI produced zero completion tokens");
  } catch (err) {
    openAiError = err instanceof Error ? err : new Error(String(err));
    console.warn("OpenAI primary streaming failed, checking Anthropic fallback:", openAiError.message);
  }

  // 2. Fallback to Anthropic only if OpenAI failed and no partial tokens were yielded
  if (tokensYielded === 0 && isAnthropicConfigured()) {
    try {
      const antKey = getAnthropicApiKey();
      const antModel = getAnthropicChatModel();

      const antMessages = [
        ...history
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-6)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: userPrompt },
      ];

      const antResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": antKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: antModel,
          system: systemPrompt,
          messages: antMessages,
          stream: true,
          max_tokens: 1500,
        }),
      });

      if (!antResponse.ok) {
        const antErr = await antResponse.text();
        throw new Error(`Anthropic HTTP ${antResponse.status}: ${antErr}`);
      }

      if (!antResponse.body) {
        throw new Error("Anthropic returned no response stream body");
      }

      const reader = antResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") continue;

          try {
            const data = JSON.parse(dataStr);
            if (data.type === "content_block_delta" && data.delta?.type === "text_delta" && data.delta.text) {
              fullText += data.delta.text;
              if (onChunk) onChunk(data.delta.text);
            }
          } catch {}
        }
      }

      if (fullText.trim()) {
        return { fullText: fullText.trim(), provider: "anthropic" };
      }
      throw new Error("Anthropic fallback produced zero completion tokens");
    } catch (antErr) {
      console.error("Anthropic fallback also failed:", antErr);
      throw new Error(
        `Primary LLM (OpenAI) failed: ${openAiError?.message}. Fallback (Anthropic) failed: ${
          antErr instanceof Error ? antErr.message : String(antErr)
        }`
      );
    }
  }

  throw openAiError || new Error("LLM completion failed");
}

/**
 * Handle meeting-scoped questions.
 * Strictly uses only that meeting's transcript, summary, actions, decisions/topics, and highlights.
 */
async function askMeetingScope({
  meetingId,
  question,
  history = [],
  user,
  supabase,
  onChunk,
  simulateOpenAiFailure,
}: AskFathomParams): Promise<AskFathomResult> {
  if (!meetingId || !meetingId.trim()) {
    throw new Error("A specific meeting ID is required for meeting scope");
  }

  const cleanId = meetingId.trim();

  // 1. Check sample demo fixture meeting
  const sample = findMeeting(cleanId);
  if (sample) {
    return handleSampleMeetingScope(sample, question, history, onChunk, simulateOpenAiFailure);
  }

  // 2. Fetch meeting with user ownership verification
  // Query via admin client to detect existence across users and distinguish 403 Forbidden vs 404 Not Found
  const admin = createAdminClient();
  const { data: meeting, error: mErr } = await admin
    .from("meetings")
    .select("id, user_id, title, status, duration, duration_seconds, meeting_time, created_at, participants")
    .eq("id", cleanId)
    .maybeSingle();

  if (mErr) {
    throw new Error(`Failed to load meeting: ${mErr.message}`);
  }

  if (!meeting) {
    throw new Error(`Meeting not found`);
  }

  if (meeting.user_id !== user.id) {
    throw new Error(`Forbidden: You do not have permission to access this meeting`);
  }

  // Check processed status: show grounded notice if processing is incomplete
  const normalizedStatus = (meeting.status || "").toLowerCase();
  const isProcessed = normalizedStatus === "completed" || normalizedStatus === "ready";
  if (!isProcessed) {
    const notice = `This meeting is currently **${meeting.status || "processing"}**. Ask Fathom requires a fully processed meeting with completed transcription and AI analysis. Please wait until processing completes to ask questions about this call.`;
    if (onChunk) onChunk(notice);
    return {
      answer: notice,
      scope: "meeting",
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      sources: [],
      provider: "grounded-notice",
    };
  }

  // 3. Load only this meeting's components: transcript, summary, actions, decisions, highlights
  const [sumRes, actRes, hlRes, segRes] = await Promise.all([
    supabase
      .from("summary_versions")
      .select("version, summary, content, overview")
      .eq("meeting_id", cleanId),
    supabase
      .from("action_items")
      .select("id, task, text, owner, due_date, completed")
      .eq("meeting_id", cleanId),
    supabase
      .from("highlights")
      .select("id, title, kind, text, start_timestamp, end_timestamp")
      .eq("meeting_id", cleanId),
    supabase
      .from("transcript_segments")
      .select("sequence, speaker, text, start_time, end_time")
      .eq("meeting_id", cleanId)
      .order("sequence", { ascending: true }),
  ]);

  const summaries = sumRes.data || [];
  const actions = actRes.data || [];
  const highlights = hlRes.data || [];
  const segments = segRes.data || [];

  const primarySummary =
    summaries.find((s) => s.version === "enhanced") ||
    summaries.find((s) => s.version === "standard") ||
    summaries[0];

  const summaryText = (primarySummary?.summary || primarySummary?.content || "").trim();
  const overviewItems: string[] = Array.isArray(primarySummary?.overview)
    ? primarySummary.overview.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  const actionLines = actions.map((a, i) => {
    const task = a.task || a.text || "Untitled action";
    const owner = a.owner ? ` (Owner: ${a.owner})` : "";
    const due = a.due_date ? ` [Due: ${a.due_date}]` : "";
    const status = a.completed ? " [Done]" : " [Pending]";
    return `${i + 1}. ${task}${owner}${due}${status}`;
  });

  const highlightLines = highlights.map((h, i) => {
    const timeRange = h.start_timestamp !== undefined
      ? ` [${formatTime(Number(h.start_timestamp))}${h.end_timestamp ? ` - ${formatTime(Number(h.end_timestamp))}` : ""}]`
      : "";
    const note = h.text ? `: ${h.text}` : "";
    return `${i + 1}. "${h.title}"${timeRange} (${h.kind || "Key moment"})${note}`;
  });

  const transcriptLines = segments.map((s) => {
    const timeStr = formatTime(Number(s.start_time));
    return `[${timeStr}] ${s.speaker || "Speaker"}: ${s.text}`;
  });

  const participantsList = Array.isArray(meeting.participants) && meeting.participants.length > 0
    ? meeting.participants.join(", ")
    : "You";

  const dateStr = meeting.meeting_time || meeting.created_at || "Recent";

  const meetingContext = `MEETING TITLE: "${meeting.title}"
DATE: ${dateStr}
PARTICIPANTS: ${participantsList}

=== EXECUTIVE SUMMARY ===
${summaryText || "No summary recorded."}

=== DECISIONS, TOPICS & KEY POINTS ===
${overviewItems.length > 0 ? overviewItems.map((o) => `• ${o}`).join("\n") : "No overview points recorded."}

=== ACTION ITEMS ===
${actionLines.length > 0 ? actionLines.join("\n") : "No action items recorded."}

=== HIGHLIGHTS & KEY MOMENTS ===
${highlightLines.length > 0 ? highlightLines.join("\n") : "No highlights recorded."}

=== FULL TRANSCRIPT ===
${transcriptLines.length > 0 ? transcriptLines.join("\n") : "No transcript segments recorded."}`;

  const systemPrompt = `You are Ask Fathom, an AI assistant answering questions about a specific meeting.
You must ONLY use the provided meeting transcript, summary, action items, decisions/topics, and highlights.
Strict Grounding Rules:
1. Base your answer strictly on what is stated in the provided context for this meeting.
2. Do not fabricate facts, extrapolate beyond what was said, or refer to any external or imaginary meetings.
3. If the answer cannot be found in this meeting's context, state clearly: "That was not discussed or mentioned in this meeting."
4. Provide structured, executive-ready responses with GitHub-flavored markdown (bullet points, bold text).
5. When referencing statements or insights from the transcript, cite the speaker name and timestamp (e.g. "Speaker 1 [02:15]").`;

  const userPrompt = `Meeting Context:
${meetingContext}

User Question:
${question}`;

  const { fullText, provider } = await streamLlmWithFallback({
    systemPrompt,
    userPrompt,
    history,
    onChunk,
    simulateOpenAiFailure,
  });

  const sources: AskSourceReference[] = [];
  if (summaryText) {
    sources.push({
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      type: "summary",
      snippet: summaryText.slice(0, 160) + (summaryText.length > 160 ? "..." : ""),
    });
  }
  for (const h of highlights.slice(0, 3)) {
    sources.push({
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      type: "highlight",
      snippet: h.title,
      timestamp: formatTime(Number(h.start_timestamp)),
    });
  }
  for (const a of actions.slice(0, 3)) {
    sources.push({
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      type: "action_item",
      snippet: a.task || a.text || "",
    });
  }

  return {
    answer: fullText,
    scope: "meeting",
    meetingId: meeting.id,
    meetingTitle: meeting.title,
    sources,
    provider,
  };
}

/**
 * Handle sample/demo meeting scope.
 */
async function handleSampleMeetingScope(
  sample: Meeting,
  question: string,
  history: AskMessage[] = [],
  onChunk?: (text: string) => void,
  simulateOpenAiFailure?: boolean
): Promise<AskFathomResult> {
  const summaryText = sample.summary || "";
  const overviewPoints = sample.overview || [];
  const actionLines = (sample.actions || []).map(
    (a, i) => `${i + 1}. ${a.text} (Owner: ${a.owner}, Due: ${a.due}, Completed: ${a.done})`
  );
  const highlightLines = (sample.highlights || []).map(
    (h, i) => `${i + 1}. "${h.title}" [${h.time}] (${h.kind})`
  );
  const transcriptLines = (sample.transcript || []).map(
    (t) => `[${t.time}] ${t.speaker}: ${t.text}`
  );

  const contextStr = `MEETING TITLE: "${sample.title}"
DATE: ${sample.date}
ATTENDEES: ${(sample.attendees || []).join(", ")}

=== EXECUTIVE SUMMARY ===
${summaryText}

=== DECISIONS, TOPICS & KEY POINTS ===
${overviewPoints.map((p) => `• ${p}`).join("\n")}

=== ACTION ITEMS ===
${actionLines.join("\n")}

=== HIGHLIGHTS ===
${highlightLines.join("\n")}

=== FULL TRANSCRIPT ===
${transcriptLines.join("\n")}`;

  const systemPrompt = `You are Ask Fathom, an AI assistant answering questions about a specific meeting.
You must ONLY use the provided meeting transcript, summary, action items, decisions/topics, and highlights.
Base your answer strictly on what is stated in the provided context for this meeting.
If the answer cannot be found in this meeting, state that clearly without guessing.
Provide well-structured answers using markdown. Cite speakers and timestamps when referencing dialogue.`;

  const userPrompt = `Meeting Context:
${contextStr}

User Question:
${question}`;

  const { fullText, provider } = await streamLlmWithFallback({
    systemPrompt,
    userPrompt,
    history,
    onChunk,
    simulateOpenAiFailure,
  });

  return {
    answer: fullText,
    scope: "meeting",
    meetingId: sample.id,
    meetingTitle: sample.title,
    sources: [
      {
        meetingId: sample.id,
        meetingTitle: sample.title,
        type: "summary",
        snippet: summaryText.slice(0, 160),
      },
      ...(sample.highlights || []).slice(0, 2).map((h) => ({
        meetingId: sample.id,
        meetingTitle: sample.title,
        type: "highlight" as const,
        snippet: h.title,
        timestamp: h.time,
      })),
    ],
    provider,
  };
}

/**
 * Handle My Calls scope.
 * Searches ONLY the authenticated user's processed meetings and retrieves
 * ONLY the most relevant meeting/transcript context instead of sending every transcript.
 */
async function askMyCallsScope({
  question,
  history = [],
  user,
  supabase,
  onChunk,
  simulateOpenAiFailure,
}: AskFathomParams): Promise<AskFathomResult> {
  // 1. Fetch only the authenticated user's processed meetings
  const { data: dbMeetings, error: mErr } = await supabase
    .from("meetings")
    .select("id, user_id, title, status, duration, duration_seconds, meeting_time, created_at, participants")
    .eq("user_id", user.id)
    .in("status", ["completed", "ready"])
    .order("meeting_time", { ascending: false });

  if (mErr) {
    throw new Error(`Failed to query processed meetings: ${mErr.message}`);
  }

  if (!dbMeetings || dbMeetings.length === 0) {
    const notice = "You do not have any processed calls in **My Calls** yet. Once your meeting recordings have completed transcription and AI analysis, you will be able to search and ask questions across all your calls here.";
    if (onChunk) onChunk(notice);
    return {
      answer: notice,
      scope: "my-calls",
      relevantMeetingCount: 0,
      sources: [],
      provider: "grounded-notice",
    };
  }

  // 2. Extract search signals
  const keywords = extractKeywords(question);
  const recencyCount = detectRecencyCount(question);
  const meetingIds = dbMeetings.map((m) => m.id);

  // 3. Fetch summary versions, action items, and highlights for candidate processed meetings
  const [sumRes, actRes, hlRes] = await Promise.all([
    supabase
      .from("summary_versions")
      .select("meeting_id, version, summary, content, overview")
      .in("meeting_id", meetingIds),
    supabase
      .from("action_items")
      .select("meeting_id, task, text, owner, due_date, completed")
      .in("meeting_id", meetingIds),
    supabase
      .from("highlights")
      .select("meeting_id, title, kind, text, start_timestamp, end_timestamp")
      .in("meeting_id", meetingIds),
  ]);

  const allSummaries = sumRes.data || [];
  const allActions = actRes.data || [];
  const allHighlights = hlRes.data || [];

  // 4. Targeted transcript search: search only for matching transcript segments
  // Instead of fetching all transcripts across all meetings, we search specifically for relevant turns!
  let matchingSegments: Array<{
    meeting_id: string;
    speaker: string;
    text: string;
    start_time: number;
    sequence: number;
  }> = [];

  if (keywords.length > 0) {
    const orFilters = keywords
      .slice(0, 3)
      .map((k) => `text.ilike.%${k}%`)
      .join(",");

    const { data: segData } = await supabase
      .from("transcript_segments")
      .select("meeting_id, speaker, text, start_time, sequence")
      .in("meeting_id", meetingIds)
      .or(orFilters)
      .limit(16);

    if (segData && segData.length > 0) {
      matchingSegments = segData;
    }
  }

  // 5. Score meetings to rank relevance
  const meetingScores = new Map<string, number>();

  dbMeetings.forEach((m, idx) => {
    let score = 0;
    // Slight recency bias (index 0 is most recent)
    score += Math.max(0, 20 - idx * 2);

    const titleLower = (m.title || "").toLowerCase();
    const participantsLower = (Array.isArray(m.participants) ? m.participants.join(" ") : "").toLowerCase();

    for (const kw of keywords) {
      if (titleLower.includes(kw)) score += 30;
      if (participantsLower.includes(kw)) score += 20;
    }

    const mSummaries = allSummaries.filter((s) => s.meeting_id === m.id);
    for (const s of mSummaries) {
      const text = ((s.summary || "") + " " + (Array.isArray(s.overview) ? s.overview.join(" ") : "")).toLowerCase();
      for (const kw of keywords) {
        if (text.includes(kw)) score += 15;
      }
    }

    const mActions = allActions.filter((a) => a.meeting_id === m.id);
    for (const a of mActions) {
      const text = ((a.task || a.text || "") + " " + (a.owner || "")).toLowerCase();
      for (const kw of keywords) {
        if (text.includes(kw)) score += 15;
      }
    }

    const mHighlights = allHighlights.filter((h) => h.meeting_id === m.id);
    for (const h of mHighlights) {
      const text = ((h.title || "") + " " + (h.text || "")).toLowerCase();
      for (const kw of keywords) {
        if (text.includes(kw)) score += 12;
      }
    }

    const segMatches = matchingSegments.filter((s) => s.meeting_id === m.id).length;
    score += segMatches * 15;

    if (recencyCount && idx < recencyCount) {
      score += 100;
    }

    meetingScores.set(m.id, score);
  });

  const rankedMeetings = [...dbMeetings].sort((a, b) => {
    const scoreA = meetingScores.get(a.id) || 0;
    const scoreB = meetingScores.get(b.id) || 0;
    return scoreB - scoreA;
  });

  const maxMeetingsToInclude = recencyCount ? Math.min(recencyCount, rankedMeetings.length) : Math.min(4, rankedMeetings.length);
  const selectedMeetings = rankedMeetings.slice(0, maxMeetingsToInclude);

  // 6. Build focused cross-meeting context
  // NOTE: Retrieve only the most relevant context, never every full transcript!
  const sources: AskSourceReference[] = [];
  const meetingContextBlocks: string[] = [];

  for (const m of selectedMeetings) {
    const mSummary =
      allSummaries.find((s) => s.meeting_id === m.id && s.version === "enhanced") ||
      allSummaries.find((s) => s.meeting_id === m.id && s.version === "standard") ||
      allSummaries.find((s) => s.meeting_id === m.id);

    const mActions = allActions.filter((a) => a.meeting_id === m.id);
    const mHighlights = allHighlights.filter((h) => h.meeting_id === m.id);
    const mSegments = matchingSegments.filter((s) => s.meeting_id === m.id);

    const dateStr = m.meeting_time || m.created_at || "Recent";
    const participantsList = Array.isArray(m.participants) && m.participants.length > 0
      ? m.participants.join(", ")
      : "You";

    const summaryText = (mSummary?.summary || mSummary?.content || "").trim();
    const overviewPoints = Array.isArray(mSummary?.overview)
      ? mSummary.overview.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      : [];

    if (summaryText) {
      sources.push({
        meetingId: m.id,
        meetingTitle: m.title,
        meetingDate: dateStr,
        type: "summary",
        snippet: summaryText.slice(0, 150) + "...",
      });
    }

    const actionSnippets = mActions.slice(0, 4).map((a) => {
      const task = a.task || a.text || "";
      const owner = a.owner ? ` (${a.owner})` : "";
      return `• ${task}${owner}`;
    });

    const highlightSnippets = mHighlights.slice(0, 3).map((h) => {
      return `• "${h.title}" [${formatTime(Number(h.start_timestamp))}]`;
    });

    const transcriptSnippets = mSegments.slice(0, 4).map((s) => {
      sources.push({
        meetingId: m.id,
        meetingTitle: m.title,
        type: "transcript",
        speaker: s.speaker,
        timestamp: formatTime(Number(s.start_time)),
        snippet: s.text,
      });
      return `[${formatTime(Number(s.start_time))}] ${s.speaker}: "${s.text}"`;
    });

    const block = `### Call: "${m.title}"
Date: ${dateStr}
Attendees: ${participantsList}
Summary: ${summaryText || "No summary available"}
Key Points / Decisions:
${overviewPoints.length > 0 ? overviewPoints.map((p) => `• ${p}`).join("\n") : "None specified"}
Action Items:
${actionSnippets.length > 0 ? actionSnippets.join("\n") : "None detected"}
Key Highlights:
${highlightSnippets.length > 0 ? highlightSnippets.join("\n") : "None detected"}
Relevant Transcript Excerpts:
${transcriptSnippets.length > 0 ? transcriptSnippets.join("\n") : "(No specific keyword dialogue turns needed - see summary above)"}`;

    meetingContextBlocks.push(block);
  }

  const systemPrompt = `You are Ask Fathom, an AI executive meeting assistant answering across the user's processed meeting library ('My Calls').
Strict Grounding Rules:
1. Base your answer strictly on the provided relevant meeting summaries, decisions, action items, and transcript excerpts.
2. Only reference meetings present in the provided context.
3. Attribute your findings to the specific call title(s) and dates (e.g. "In 'Every Zoom Meeting' (Sep 24)...").
4. If asked to summarize multiple calls, provide a clear structured breakdown or cross-call comparison as requested.
5. If the user's question asks for something not mentioned in any of their processed calls, clearly state that it was not found in their calls rather than guessing.
6. Provide concise, professional, well-formatted answers using GitHub-flavored markdown.`;

  const userPrompt = `Retrieved Relevant Calls Context:
${meetingContextBlocks.join("\n\n---\n\n")}

User Question:
${question}`;

  const { fullText, provider } = await streamLlmWithFallback({
    systemPrompt,
    userPrompt,
    history,
    onChunk,
    simulateOpenAiFailure,
  });

  return {
    answer: fullText,
    scope: "my-calls",
    relevantMeetingCount: selectedMeetings.length,
    sources,
    provider,
  };
}

/**
 * Main Ask Fathom dispatcher.
 */
export async function askFathom(params: AskFathomParams): Promise<AskFathomResult> {
  if (!params.question || !params.question.trim()) {
    throw new Error("Question cannot be empty");
  }

  if (params.scope === "meeting") {
    return askMeetingScope(params);
  }

  if (params.scope === "my-calls") {
    return askMyCallsScope(params);
  }

  throw new Error(`Invalid scope: ${params.scope}. Must be 'my-calls' or 'meeting'.`);
}
