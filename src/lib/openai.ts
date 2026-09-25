/**
 * OpenAI client and prompt orchestrator for meeting analysis.
 * Privileged API keys remain strictly server-side.
 */

export interface ActionItemResult {
  task: string;
  owner: string;
  due_date: string | null;
}

export interface TopicResult {
  name: string;
  summary: string;
}

export interface HighlightResult {
  title: string;
  start_timestamp: number;
  end_timestamp: number;
  kind: string;
}

export interface MeetingAnalysisResult {
  summary: string;
  key_points: string[];
  decisions: string[];
  action_items: ActionItemResult[];
  topics: TopicResult[];
  highlights: HighlightResult[];
}

export interface TranscriptTurnInput {
  sequence: number;
  speaker: string;
  text: string;
  start_time: number;
  end_time: number;
}

const OPENAI_API_BASE = "https://api.openai.com/v1";

/**
 * Retrieves the OpenAI API key from server environment variables.
 * Never expose this key to client-side code.
 */
export function getOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("OPENAI_API_KEY is not configured on the server");
  }
  return apiKey.trim();
}

/**
 * Retrieves the OpenAI analysis model name from server environment variables.
 */
export function getOpenAiAnalysisModel(): string {
  return (
    process.env.OPENAI_ANALYSIS_MODEL?.trim() ||
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    "gpt-4o"
  );
}

/**
 * Parses numeric timestamp from value that might be number or string like "52.59s".
 */
function parseTimestampNumber(val: unknown, fallback: number = 0): number {
  if (typeof val === "number" && !Number.isNaN(val) && Number.isFinite(val)) {
    return Math.max(0, Math.round(val * 1000) / 1000);
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed * 1000) / 1000);
    }
  }
  return fallback;
}

/**
 * Analyzes meeting transcript segments using OpenAI to extract structured
 * summary, key points, decisions, action items, topics, and suggested highlights.
 */
export async function analyzeMeetingWithOpenAi(
  segments: TranscriptTurnInput[],
  meetingTitle?: string
): Promise<MeetingAnalysisResult> {
  const apiKey = getOpenAiApiKey();
  const model = getOpenAiAnalysisModel();

  if (!segments || segments.length === 0) {
    throw new Error("Cannot analyze meeting: transcript segments are empty");
  }

  // Format segments into readable dialogue with speaker and timestamps
  const formattedTranscript = segments
    .slice()
    .sort((a, b) => a.sequence - b.sequence || a.start_time - b.start_time)
    .map(
      (s) =>
        `[${s.start_time.toFixed(2)}s - ${s.end_time.toFixed(2)}s] ${s.speaker}: ${s.text}`
    )
    .join("\n");

  const systemPrompt = `You are an expert executive meeting analyst and summarizer.
Your goal is to extract thorough, accurate, and faithful structured information from real meeting transcripts.
Analyze the conversation strictly based on what is said in the transcript.
You must return a single valid JSON object matching the requested schema with no extra commentary or markdown formatting.`;

  const userPrompt = `Please analyze the following meeting transcript${
    meetingTitle ? ` titled "${meetingTitle}"` : ""
  }.

Provide a comprehensive, structured analysis in valid JSON format with the following exact keys:

1. "summary": A clear, executive overview paragraph (3-5 sentences) summarizing the main purpose, discussion flow, and conclusion of the meeting.
2. "key_points": An array of strings representing key discussion points, insights, and takeaways.
3. "decisions": An array of strings representing concrete decisions, agreements, or outcomes reached during the call.
4. "action_items": An array of objects with:
   - "task": string (specific action or deliverable)
   - "owner": string (person assigned to the task, or "Unassigned" if unspecified)
   - "due_date": string or null (timeframe or due date if mentioned, otherwise null)
5. "topics": An array of objects with:
   - "name": string (topic title)
   - "summary": string (brief summary of discussion under this topic)
6. "highlights": An array of objects representing notable clips/moments with:
   - "title": string (descriptive title of the moment)
   - "start_timestamp": number (starting second in the recording as a numeric float, e.g. 52.59)
   - "end_timestamp": number (ending second in the recording as a numeric float, e.g. 66.15)
   - "kind": string (e.g. "Key Moment", "Decision", "Update", "Action Item")

Transcript:
${formattedTranscript}`;

  const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMessage = errorBody;
    try {
      const json = JSON.parse(errorBody);
      parsedMessage = json.error?.message || json.message || errorBody;
    } catch {
      // Use raw errorBody
    }
    throw new Error(`OpenAI API error (${response.status}): ${parsedMessage}`);
  }

  const completion = await response.json();
  const rawContent = completion.choices?.[0]?.message?.content;
  if (!rawContent || !rawContent.trim()) {
    throw new Error("OpenAI returned an empty response body");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawContent);
  } catch (parseErr) {
    throw new Error(
      `Failed to parse OpenAI JSON response: ${
        parseErr instanceof Error ? parseErr.message : "Invalid JSON"
      }`
    );
  }

  // Strict Validation and Sanitization
  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : "";
  if (!summary) {
    throw new Error("OpenAI response missing valid 'summary' string");
  }

  const keyPoints: string[] = Array.isArray(parsed.key_points)
    ? parsed.key_points
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];

  const decisions: string[] = Array.isArray(parsed.decisions)
    ? parsed.decisions
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];

  const actionItems: ActionItemResult[] = Array.isArray(parsed.action_items)
    ? parsed.action_items
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => {
          const task = typeof item.task === "string" ? item.task.trim() : "";
          const owner =
            typeof item.owner === "string" && item.owner.trim()
              ? item.owner.trim()
              : "Unassigned";
          const dueDate =
            typeof item.due_date === "string" && item.due_date.trim()
              ? item.due_date.trim()
              : null;
          return { task, owner, due_date: dueDate };
        })
        .filter((item) => item.task.length > 0)
    : [];

  const topics: TopicResult[] = Array.isArray(parsed.topics)
    ? parsed.topics
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          name: typeof item.name === "string" ? item.name.trim() : "General",
          summary: typeof item.summary === "string" ? item.summary.trim() : "",
        }))
        .filter((item) => item.name.length > 0)
    : [];

  const maxDuration = segments.reduce((max, s) => Math.max(max, s.end_time), 0);

  const highlights: HighlightResult[] = Array.isArray(parsed.highlights)
    ? parsed.highlights
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => {
          const title = typeof item.title === "string" ? item.title.trim() : "Highlight";
          let start = parseTimestampNumber(item.start_timestamp, 0);
          let end = parseTimestampNumber(item.end_timestamp, start + 10);
          if (end < start) {
            end = start + 5;
          }
          if (maxDuration > 0 && start > maxDuration) {
            start = Math.max(0, maxDuration - 10);
            end = maxDuration;
          }
          const kind = typeof item.kind === "string" && item.kind.trim() ? item.kind.trim() : "Highlight";
          return {
            title,
            start_timestamp: start,
            end_timestamp: end,
            kind,
          };
        })
        .filter((item) => item.title.length > 0)
    : [];

  return {
    summary,
    key_points: keyPoints,
    decisions,
    action_items: actionItems,
    topics,
    highlights,
  };
}
