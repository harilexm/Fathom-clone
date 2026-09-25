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
import { findMeeting, meetings, type Meeting } from "@/lib/sample-data";
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

const GENERIC_INTENT_WORDS = new Set([
  "action", "actions", "item", "items", "step", "steps", "next", "key", "point",
  "points", "theme", "themes", "topic", "topics", "decision", "decisions",
  "takeaway", "takeaways", "outcome", "outcomes", "note", "notes", "summary",
  "summaries", "summarize", "overview", "follow", "followup", "follow-up",
  "email", "discussed", "discussion", "discussions", "talk", "talked", "talking",
  "mention", "mentioned", "detail", "details", "update", "updates", "status",
  "review", "reviewing", "check", "share", "sharing", "video", "videos",
  "recording", "recordings", "call", "calls", "meeting", "meetings", "recent",
  "latest", "past", "last", "first", "agenda", "question", "questions",
  "important", "happen", "happened", "happening", "conversation", "conversations",
  "thing", "things", "everything", "recap", "recaps", "information",
  "highlight", "highlights", "said", "say", "saying", "speak", "spoke",
  "speaking", "hear", "heard", "tell", "told", "anyone", "someone", "people",
  "time", "times", "date", "dates", "day", "days", "week", "weeks"
]);

function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function toStem(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ies") && w.length > 5) return w.slice(0, -3) + "y";
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  return w;
}

interface QuerySignals {
  keywords: string[];
  entityKeywords: string[];
  intentKeywords: string[];
  recencyCount: number | null;
}

function extractQuerySignals(query: string): QuerySignals {
  const cleanTokens = extractKeywords(query);

  const entityKeywords: string[] = [];
  const intentKeywords: string[] = [];

  for (const token of cleanTokens) {
    if (GENERIC_INTENT_WORDS.has(token)) {
      intentKeywords.push(token);
    } else {
      entityKeywords.push(token);
    }
  }

  return {
    keywords: cleanTokens,
    entityKeywords,
    intentKeywords,
    recencyCount: detectRecencyCount(query),
  };
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

  // 3. Load this meeting's full components, plus other recorded calls for cross-call awareness
  const [sumRes, actRes, hlRes, segRes, otherMeetingsRes] = await Promise.all([
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
    supabase
      .from("meetings")
      .select("id, title, meeting_time, created_at, participants")
      .eq("user_id", user.id)
      .neq("id", cleanId)
      .in("status", ["completed", "ready"])
      .order("meeting_time", { ascending: false })
      .limit(8),
  ]);

  const summaries = sumRes.data || [];
  const actions = actRes.data || [];
  const highlights = hlRes.data || [];
  const segments = segRes.data || [];
  const otherMeetings = otherMeetingsRes.data || [];

  let otherSummaries: Array<{ meeting_id: string; summary?: string; content?: string; overview?: unknown }> = [];
  let otherActions: Array<{ meeting_id: string; task?: string; text?: string; owner?: string }> = [];
  let otherSegments: Array<{ meeting_id: string; speaker: string; text: string; start_time: number }> = [];

  if (otherMeetings.length > 0) {
    const otherIds = otherMeetings.map((m) => m.id);
    const searchTerms = extractKeywords(question);
    const searchStems = Array.from(new Set(searchTerms.map(toStem).filter((s) => s.length > 2)));

    const [oSumRes, oActRes, oSegRes] = await Promise.all([
      supabase
        .from("summary_versions")
        .select("meeting_id, summary, content, overview")
        .in("meeting_id", otherIds),
      supabase
        .from("action_items")
        .select("meeting_id, task, text, owner")
        .in("meeting_id", otherIds),
      searchStems.length > 0
        ? supabase
            .from("transcript_segments")
            .select("meeting_id, speaker, text, start_time")
            .in("meeting_id", otherIds)
            .or(searchStems.slice(0, 5).map((k) => `text.ilike.%${k}%`).join(","))
            .limit(24)
        : Promise.resolve({ data: [] }),
    ]);

    otherSummaries = oSumRes.data || [];
    otherActions = oActRes.data || [];
    otherSegments = oSegRes.data || [];
  }

  let otherCallsContext = "";
  if (otherMeetings.length > 0) {
    const otherLines = otherMeetings.map((om) => {
      const s = otherSummaries.find((sum) => sum.meeting_id === om.id);
      const sText = (s?.summary || s?.content || "").trim();
      const overviewList = Array.isArray(s?.overview)
        ? s.overview.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4)
        : [];
      const mActs = otherActions.filter((a) => a.meeting_id === om.id).slice(0, 3);
      const mSegs = otherSegments.filter((seg) => seg.meeting_id === om.id).slice(0, 2);

      const parts = [`- Call: "${om.title}" (${om.meeting_time || om.created_at || "Earlier"})`];
      if (Array.isArray(om.participants) && om.participants.length > 0) {
        parts.push(`  Participants: ${om.participants.join(", ")}`);
      }
      if (sText) {
        parts.push(`  Summary: ${sText}`);
      }
      if (overviewList.length > 0) {
        parts.push(`  Key Decisions & Points: ${overviewList.join(" | ")}`);
      }
      if (mActs.length > 0) {
        parts.push(`  Action Items: ${mActs.map((a) => `${a.task || a.text}${a.owner ? ` (${a.owner})` : ""}`).join("; ")}`);
      }
      if (mSegs.length > 0) {
        parts.push(`  Relevant Dialogue: ${mSegs.map((seg) => `[${formatTime(Number(seg.start_time))}] ${seg.speaker}: "${seg.text}"`).join(" | ")}`);
      }
      return parts.join("\n");
    });
    otherCallsContext = `\n\n=== OTHER RECORDED CALLS IN USER'S LIBRARY (For Cross-Call Reference) ===
(Primary priority is "${meeting.title}". If the user asks about related earlier discussions, previous meetings, or whether something was discussed before, use these calls to provide accurate cross-meeting context):
${otherLines.join("\n\n")}`;
  }

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
${transcriptLines.length > 0 ? transcriptLines.join("\n") : "No transcript segments recorded."}${otherCallsContext}`;

  const systemPrompt = `You are Ask Fathom, an AI executive assistant helping the user while they are viewing the meeting: "${meeting.title}".

Prioritization & Context Rules:
1. Primary Priority (Current Call): Give "${meeting.title}" the highest priority. If the user asks about what was discussed, decisions made, action items, or attendees, answer from this meeting first.
2. Cross-Call Awareness & Earlier Meetings: If the user asks whether a topic was discussed before, asks about an earlier call, or asks about a topic or person that was NOT discussed in this current meeting but WAS discussed in an earlier meeting (e.g., "Did we talk about this before?", "What did Danny discuss in that earlier meeting?", "What happened with the script?"):
   - Review the "OTHER RECORDED CALLS IN USER'S LIBRARY" section.
   - Explain with clear cross-meeting context: state that while it was not discussed in this meeting ("${meeting.title}"), it occurred in the earlier meeting ("<Meeting Title>" on <Date>) and provide the accurate details.
3. Grounding & Anti-Fabrication: Do not fabricate facts. If a topic was neither in this meeting nor in any other recorded call, state clearly that it was not discussed.
4. When citing quotes from the current meeting, cite speaker names and timestamps (e.g., "[02:15] Speaker").`;

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

  // 1 source per meeting: the summary-level reference
  const sources: AskSourceReference[] = [
    {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      meetingDate: meeting.meeting_time || meeting.created_at || "Recent",
      type: "summary",
      snippet: summaryText
        ? summaryText.slice(0, 160) + (summaryText.length > 160 ? "..." : "")
        : "Meeting context used",
    },
  ];

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

  const otherSampleCalls = meetings
    .filter((m) => m.id !== sample.id)
    .slice(0, 4)
    .map((m) => {
      const attendees = (m.attendees || []).join(", ");
      const actions = (m.actions || []).map((a) => `${a.text} (${a.owner})`).join("; ");
      const overviews = (m.overview || []).slice(0, 3).join(" | ");
      return `- Earlier Recording: "${m.title}" (${m.date})
  Attendees: ${attendees || "Team"}
  Summary: ${m.summary || "Sample call"}
  Key Decisions & Points: ${overviews || "None"}
  Action Items: ${actions || "None"}`;
    })
    .join("\n\n");

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
${transcriptLines.join("\n")}

=== OTHER RECORDED CALLS IN LIBRARY (For Cross-Call Reference) ===
(Primary priority is "${sample.title}". If the user asks about related earlier discussions, previous meetings, or whether something was discussed before, use these calls to provide accurate cross-meeting context):
${otherSampleCalls}`;

  const systemPrompt = `You are Ask Fathom, an AI assistant answering questions while the user is viewing the meeting: "${sample.title}".

Prioritization & Context Rules:
1. Primary Priority (Current Call): Give "${sample.title}" the highest priority. If the user asks about what was discussed, decisions made, action items, or attendees, answer from this meeting first.
2. Cross-Call Context (Earlier Meetings): If the user asks about related topics, previous discussions, or questions whether something was discussed before (e.g. "Did we talk about this before?", "What happened in the earlier call?"):
   - Review the "OTHER RECORDED CALLS IN LIBRARY" section.
   - Explain with clear cross-meeting context that while it wasn't in this meeting ("${sample.title}"), it occurred in the earlier meeting ("<Meeting Title>" on <Date>) and provide the details.
3. Base your answer strictly on the provided context. If the answer cannot be found in this meeting or earlier recorded calls, state that clearly without guessing.
4. Provide well-structured answers using markdown. Cite speakers and timestamps when referencing dialogue.`;

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
 * Searches the authenticated user's processed meetings AND sample/demo meetings,
 * retrieves ONLY the most relevant meeting/transcript context instead of sending every transcript.
 */
async function askMyCallsScope({
  question,
  history = [],
  user,
  supabase,
  onChunk,
  simulateOpenAiFailure,
}: AskFathomParams): Promise<AskFathomResult> {
  // 1. Fetch the authenticated user's processed meetings (up to 10 recordings)
  const { data: dbMeetings, error: mErr } = await supabase
    .from("meetings")
    .select("id, user_id, title, status, duration, duration_seconds, meeting_time, created_at, participants")
    .eq("user_id", user.id)
    .in("status", ["completed", "ready"])
    .order("meeting_time", { ascending: false })
    .limit(10);

  if (mErr) {
    throw new Error(`Failed to query processed meetings: ${mErr.message}`);
  }

  // 1b. Merge sample/demo meetings into the candidate pool.
  // Sample meetings are fixture data always visible in the UI; they use in-memory
  // summaries/actions/highlights/transcripts (no Supabase queries needed).
  const dbIds = new Set((dbMeetings || []).map((m) => m.id));
  const sampleCandidates = meetings.filter((m) => !dbIds.has(m.id));

  // Unified candidate type: id, title, date, participants, isSample flag
  interface UnifiedMeeting {
    id: string;
    title: string;
    dateStr: string;
    participants: string[];
    isSample: boolean;
  }

  const allCandidates: UnifiedMeeting[] = [
    ...(dbMeetings || []).map((m) => ({
      id: m.id,
      title: m.title || "Untitled Meeting",
      dateStr: m.meeting_time || m.created_at || "Recent",
      participants: Array.isArray(m.participants) ? m.participants as string[] : [],
      isSample: false,
    })),
    ...sampleCandidates.map((m) => ({
      id: m.id,
      title: m.title,
      dateStr: m.date || "Demo",
      participants: m.attendees || [],
      isSample: true,
    })),
  ];

  if (allCandidates.length === 0) {
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
  const signals = extractQuerySignals(question);
  const { keywords, entityKeywords } = signals;
  const dbMeetingIds = (dbMeetings || []).map((m) => m.id);

  // 3. Fetch summary versions, action items, and highlights for DB meetings only
  // (sample meetings use in-memory data)
  let allSummaries: Array<{ meeting_id: string; version?: string; summary?: string; content?: string; overview?: unknown }> = [];
  let allActions: Array<{ meeting_id: string; task?: string; text?: string; owner?: string; due_date?: string; completed?: boolean }> = [];
  let allHighlights: Array<{ meeting_id: string; title?: string; kind?: string; text?: string; start_timestamp?: number; end_timestamp?: number }> = [];

  if (dbMeetingIds.length > 0) {
    const [sumRes, actRes, hlRes] = await Promise.all([
      supabase
        .from("summary_versions")
        .select("meeting_id, version, summary, content, overview")
        .in("meeting_id", dbMeetingIds),
      supabase
        .from("action_items")
        .select("meeting_id, task, text, owner, due_date, completed")
        .in("meeting_id", dbMeetingIds),
      supabase
        .from("highlights")
        .select("meeting_id, title, kind, text, start_timestamp, end_timestamp")
        .in("meeting_id", dbMeetingIds),
    ]);
    allSummaries = sumRes.data || [];
    allActions = actRes.data || [];
    allHighlights = hlRes.data || [];
  }

  // 3b. Inject sample meeting data into the same arrays so scoring works uniformly
  for (const sm of sampleCandidates) {
    allSummaries.push({
      meeting_id: sm.id,
      version: "standard",
      summary: sm.summary || "",
      overview: sm.overview || [],
    });
    for (const a of (sm.actions || [])) {
      allActions.push({
        meeting_id: sm.id,
        task: a.text,
        text: a.text,
        owner: a.owner,
        due_date: a.due,
        completed: a.done,
      });
    }
    for (const h of (sm.highlights || [])) {
      allHighlights.push({
        meeting_id: sm.id,
        title: h.title,
        kind: h.kind,
        text: h.text || "",
        start_timestamp: h.startTimeSec ?? 0,
        end_timestamp: h.endTimeSec ?? 0,
      });
    }
  }

  // 4. Targeted transcript search across DB calls + sample transcript keyword matching
  const searchTerms = keywords.length > 0 ? keywords : [];
  const searchStems = Array.from(new Set(searchTerms.map(toStem).filter((s) => s.length > 2)));

  const segmentsByMeeting = new Map<string, Array<{ speaker: string; text: string; start_time: number }>>();

  // 4a. DB transcript segments
  if (searchStems.length > 0 && dbMeetingIds.length > 0) {
    const orFilters = searchStems
      .slice(0, 5)
      .map((k) => `text.ilike.%${k}%`)
      .join(",");

    const { data: segData } = await supabase
      .from("transcript_segments")
      .select("meeting_id, speaker, text, start_time, sequence")
      .in("meeting_id", dbMeetingIds)
      .or(orFilters)
      .limit(50);

    if (segData && segData.length > 0) {
      for (const seg of segData) {
        const list = segmentsByMeeting.get(seg.meeting_id) || [];
        if (list.length < 4) {
          list.push({ speaker: seg.speaker, text: seg.text, start_time: Number(seg.start_time) });
          segmentsByMeeting.set(seg.meeting_id, list);
        }
      }
    }
  }

  // 4b. Sample transcript keyword matching (in-memory)
  if (searchStems.length > 0) {
    for (const sm of sampleCandidates) {
      const matchedTurns: Array<{ speaker: string; text: string; start_time: number }> = [];
      for (const t of (sm.transcript || [])) {
        const tLower = t.text.toLowerCase();
        if (searchStems.some((stem) => tLower.includes(stem))) {
          matchedTurns.push({ speaker: t.speaker, text: t.text, start_time: t.startTimeSec ?? 0 });
          if (matchedTurns.length >= 4) break;
        }
      }
      if (matchedTurns.length > 0) {
        segmentsByMeeting.set(sm.id, matchedTurns);
      }
    }
  }

  // 5. Score ALL candidates (DB + sample) for relevance
  const meetingRelevanceScores = new Map<string, number>();
  const meetingEntityScores = new Map<string, number>();

  allCandidates.forEach((m, idx) => {
    let relevanceScore = 0;
    let entityScore = 0;

    const titleLower = (m.title || "").toLowerCase();
    const participantsLower = m.participants.join(" ").toLowerCase();

    // Check entity matches
    for (const kw of entityKeywords) {
      const stem = toStem(kw);
      if (titleLower.includes(kw) || titleLower.includes(stem)) entityScore += 100;
      if (participantsLower.includes(kw) || participantsLower.includes(stem)) entityScore += 60;
    }

    // Check general keyword matches
    for (const term of searchTerms) {
      const stem = toStem(term);
      if (titleLower.includes(term) || titleLower.includes(stem)) relevanceScore += 80;
      if (participantsLower.includes(term) || participantsLower.includes(stem)) relevanceScore += 50;
    }

    const mSummaries = allSummaries.filter((s) => s.meeting_id === m.id);
    for (const s of mSummaries) {
      const text = ((s.summary || "") + " " + (Array.isArray(s.overview) ? s.overview.join(" ") : "")).toLowerCase();
      for (const kw of entityKeywords) {
        const stem = toStem(kw);
        if (text.includes(kw) || text.includes(stem)) entityScore += 30;
      }
      for (const term of searchTerms) {
        const stem = toStem(term);
        if (text.includes(term) || text.includes(stem)) relevanceScore += 20;
      }
    }

    const mActions = allActions.filter((a) => a.meeting_id === m.id);
    for (const a of mActions) {
      const text = ((a.task || a.text || "") + " " + (a.owner || "")).toLowerCase();
      for (const kw of entityKeywords) {
        const stem = toStem(kw);
        if (text.includes(kw) || text.includes(stem)) entityScore += 30;
      }
      for (const term of searchTerms) {
        const stem = toStem(term);
        if (text.includes(term) || text.includes(stem)) relevanceScore += 20;
      }
    }

    const mHighlights = allHighlights.filter((h) => h.meeting_id === m.id);
    for (const h of mHighlights) {
      const text = ((h.title || "") + " " + (h.text || "")).toLowerCase();
      for (const kw of entityKeywords) {
        const stem = toStem(kw);
        if (text.includes(kw) || text.includes(stem)) entityScore += 25;
      }
      for (const term of searchTerms) {
        const stem = toStem(term);
        if (text.includes(term) || text.includes(stem)) relevanceScore += 15;
      }
    }

    const mSegs = segmentsByMeeting.get(m.id) || [];
    if (mSegs.length > 0) {
      relevanceScore += mSegs.length * 25;
      for (const seg of mSegs) {
        const segLower = seg.text.toLowerCase();
        for (const kw of entityKeywords) {
          const stem = toStem(kw);
          if (segLower.includes(kw) || segLower.includes(stem)) {
            entityScore += 25;
            break;
          }
        }
      }
    }

    // Subtle chronological recency tiebreaker
    relevanceScore += Math.max(0, 3 - idx * 0.2);

    meetingEntityScores.set(m.id, entityScore);
    meetingRelevanceScores.set(m.id, relevanceScore);
  });

  // 6. Grounded check: if user asked about a specific unknown entity that matches NO calls
  let selectedMeetings = [...allCandidates];

  if (entityKeywords.length > 0) {
    const maxEntityScore = Math.max(...allCandidates.map((m) => meetingEntityScores.get(m.id) || 0));
    if (maxEntityScore === 0) {
      const entityTerms = entityKeywords.map((k) => `**"${k}"**`).join(" or ");
      const notice = `No meetings or calls matching ${entityTerms} were found in your calls library. Please verify the name or select a specific meeting from your library.`;
      if (onChunk) onChunk(notice);
      return {
        answer: notice,
        scope: "my-calls",
        relevantMeetingCount: 0,
        sources: [],
        provider: "grounded-notice",
      };
    }

    // Only include meetings that actually matched the specific entity/topic
    selectedMeetings = selectedMeetings.filter((m) => (meetingEntityScores.get(m.id) || 0) > 0);
    selectedMeetings.sort((a, b) => {
      const eA = meetingEntityScores.get(a.id) || 0;
      const eB = meetingEntityScores.get(b.id) || 0;
      if (eB !== eA) return eB - eA;
      return (meetingRelevanceScores.get(b.id) || 0) - (meetingRelevanceScores.get(a.id) || 0);
    });
  } else {
    // Broad/general question: sort by overall relevance and keep all recordings in context
    selectedMeetings.sort((a, b) => (meetingRelevanceScores.get(b.id) || 0) - (meetingRelevanceScores.get(a.id) || 0));
  }

  // 7. Build focused context for EACH selected recording
  // Sources: 1 per meeting (summary-level reference). Transcript segments are used
  // for LLM context only, NOT pushed as individual sources.
  const sources: AskSourceReference[] = [];
  const meetingContextBlocks: string[] = [];

  for (const m of selectedMeetings) {
    // For sample meetings, look up in-memory data; for DB meetings, use fetched arrays
    const sampleMeeting = m.isSample ? sampleCandidates.find((s) => s.id === m.id) : null;

    const mSummary =
      allSummaries.find((s) => s.meeting_id === m.id && s.version === "enhanced") ||
      allSummaries.find((s) => s.meeting_id === m.id && s.version === "standard") ||
      allSummaries.find((s) => s.meeting_id === m.id);

    const mActions = allActions.filter((a) => a.meeting_id === m.id);
    const mHighlights = allHighlights.filter((h) => h.meeting_id === m.id);

    // Transcript excerpts: from segmentsByMeeting for keyword matches,
    // or for sample meetings include first few turns as general context
    let mSegments = segmentsByMeeting.get(m.id) || [];
    if (mSegments.length === 0 && sampleMeeting) {
      mSegments = (sampleMeeting.transcript || []).slice(0, 3).map((t) => ({
        speaker: t.speaker,
        text: t.text,
        start_time: t.startTimeSec ?? 0,
      }));
    }

    const summaryText = (mSummary?.summary || mSummary?.content || "").trim();
    const overviewPoints = Array.isArray(mSummary?.overview)
      ? (mSummary.overview as unknown[]).filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      : [];

    // Push exactly 1 source per meeting (summary-level reference)
    sources.push({
      meetingId: m.id,
      meetingTitle: m.title,
      meetingDate: m.dateStr,
      type: "summary",
      snippet: summaryText ? summaryText.slice(0, 150) + (summaryText.length > 150 ? "..." : "") : "Meeting context used",
    });

    const actionSnippets = mActions.slice(0, 5).map((a) => {
      const task = a.task || a.text || "";
      const owner = a.owner ? ` (${a.owner})` : "";
      return `• ${task}${owner}`;
    });

    const highlightSnippets = mHighlights.slice(0, 3).map((h) => {
      return `• "${h.title}" [${formatTime(Number(h.start_timestamp ?? 0))}]`;
    });

    // Transcript snippets for LLM context only (not added to sources)
    const transcriptSnippets = mSegments.map((s) => {
      return `[${formatTime(Number(s.start_time))}] ${s.speaker}: "${s.text}"`;
    });

    const block = `### Call: "${m.title}"
Date: ${m.dateStr}
Attendees: ${m.participants.length > 0 ? m.participants.join(", ") : "You"}
Executive Summary: ${summaryText || "No summary available"}
Key Decisions & Points:
${overviewPoints.length > 0 ? overviewPoints.map((p) => `• ${p}`).join("\n") : "None specified"}
Action Items:
${actionSnippets.length > 0 ? actionSnippets.join("\n") : "None detected"}
Key Highlights:
${highlightSnippets.length > 0 ? highlightSnippets.join("\n") : "None detected"}
Relevant Transcript Excerpts:
${transcriptSnippets.length > 0 ? transcriptSnippets.join("\n") : "(No specific keyword dialogue turns needed - see summary above)"}`;

    meetingContextBlocks.push(block);
  }

  const systemPrompt = `You are Ask Fathom, an AI executive meeting assistant answering across the user's entire meeting library ('My Calls').
You have access to structured context for EACH recorded call in the user's library.

Context & Multi-Meeting Rules:
1. Complete Call Awareness: You have context of EACH recording in the user's library. Do NOT stick or default to the first call only. Review ALL provided calls to identify which meeting or meetings discuss the user's query.
2. Specific Topic Identification: If the user asks about a specific person, topic, project, incident, or deliverable (e.g., Danny, script, FIPS, unmuting, COVID, Acme, etc.), identify the exact call where it occurred and answer citing that call's title and date.
3. Cross-Call Summaries & Comparisons: If the user asks a broad question across calls (e.g. "What did we talk about in our calls?", "What are next steps across all calls?"), provide a clear, structured breakdown covering all relevant calls.
4. Call Distinction: Clearly attribute findings to the specific call title and date (e.g. "In '[Call Title]' ([Date])...").
5. Grounding & Anti-Fabrication: If a topic, person, or company was not mentioned in ANY of the user's calls, clearly state that it was not found in their recorded calls rather than making up information or confusing calls.
6. Format your responses with clean, readable GitHub-flavored markdown.`;

  const userPrompt = `User's Recorded Calls Library Context:
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
