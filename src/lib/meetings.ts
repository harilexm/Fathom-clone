import type { Meeting } from "@/lib/sample-data";

const SPEAKER_COLORS = [
  "bg-[#283d61] text-[#c3d5ff]",
  "bg-[#214656] text-[#b8e7f2]",
  "bg-[#4e3b2d] text-[#f7d5a7]",
  "bg-[#50372e] text-[#f4c6ae]",
  "bg-[#263f67] text-[#c2d8ff]",
  "bg-[#4e3243] text-[#f3c3d7]",
  "bg-[#214c4b] text-[#b4ebe4]",
  "bg-[#39482c] text-[#d9eab5]",
  "bg-[#4a3257] text-[#dbb8f0]",
  "bg-[#3b4a2c] text-[#c8e89e]",
];

export interface DbMeetingRecord {
  id: string;
  user_id: string;
  title: string;
  source: string;
  status: string;
  meeting_time?: string | null;
  duration?: number;
  duration_seconds?: number;
  participants?: string[] | null;
  soniox_job_id?: string | null;
  transcription_job_id?: string | null;
  created_at: string;
  updated_at?: string;
  recordings?: Array<{
    id: string;
    meeting_id: string;
    r2_object_key: string;
    mime_type: string;
    size: number;
    size_bytes: number;
    duration?: number;
    duration_seconds?: number;
    status: string;
    soniox_job_id?: string | null;
    transcription_job_id?: string | null;
    created_at: string;
  }>;
  summary_versions?: Array<{
    version: string;
    summary: string;
    content?: string | null;
    overview?: unknown;
    created_at: string;
  }>;
  transcript_segments?: Array<{
    id: string;
    speaker: string;
    speaker_initials?: string | null;
    text: string;
    start_time: number;
    sequence: number;
  }>;
  action_items?: Array<{
    id: string;
    task: string;
    text?: string | null;
    owner: string;
    due_date?: string | null;
    due_at?: string | null;
    completed: boolean;
  }>;
  highlights?: Array<{
    id: string;
    title: string;
    start_timestamp: number;
    start_time: number;
    end_timestamp?: number;
    end_time?: number;
    kind?: string | null;
    text?: string | null;
  }>;
  share_links?: Array<{
    id: string;
    token: string;
    status: string;
    is_active?: boolean;
    created_at: string;
    highlight_id?: string | null;
  }>;
}

export function formatMeetingDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const formattedMonthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (isToday) {
    return `Today, ${formattedMonthDay}`;
  }

  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isThisYear) {
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    return `${weekday}, ${formattedMonthDay}`;
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatMeetingTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatMeetingDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const wholeSeconds = Math.round(seconds);
  if (wholeSeconds < 60) {
    return `${wholeSeconds}s`;
  }
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }

  if (minutes < 5 && remainingSeconds > 0) {
    return `${minutes} min ${remainingSeconds}s`;
  }
  return `${minutes} min`;
}

export function getLatestRecording(dbMeeting: DbMeetingRecord) {
  return dbMeeting.recordings
    ?.filter((recording) => recording.r2_object_key)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = String(total % 60).padStart(2, "0");
  return hours > 0 ? hours + ":" + String(minutes).padStart(2, "0") + ":" + remainder : minutes + ":" + remainder;
}

export function mapDbMeetingToMeeting(dbMeeting: DbMeetingRecord): Meeting {
  const latestRecording = getLatestRecording(dbMeeting);

  const dateStr = dbMeeting.created_at || new Date().toISOString();
  const dateFormatted = formatMeetingDate(dateStr);
  const timeFormatted = formatMeetingTime(dateStr);

  let durationSec =
    latestRecording?.duration_seconds ||
    latestRecording?.duration ||
    dbMeeting.duration_seconds ||
    dbMeeting.duration ||
    0;

  if (!durationSec && Array.isArray(dbMeeting.transcript_segments) && dbMeeting.transcript_segments.length > 0) {
    const maxSegment = Math.max(...dbMeeting.transcript_segments.map((s) => s.start_time || 0));
    if (maxSegment > 0) durationSec = Math.round(maxSegment);
  }

  const durationText = formatMeetingDuration(durationSec);

  // Status mapping
  const rawStatus = dbMeeting.status || latestRecording?.status || "uploaded";
  let statusText = "Uploaded";
  const lowerStatus = rawStatus.toLowerCase();
  if (lowerStatus === "ready") statusText = "Ready";
  else if (lowerStatus === "completed") statusText = "Completed";
  else if (lowerStatus === "processing") statusText = "Processing";
  else if (lowerStatus === "transcribing") statusText = "Transcribing";
  else if (lowerStatus === "analyzing") statusText = "Analyzing";
  else if (lowerStatus === "failed") statusText = "Failed";
  else if (lowerStatus === "uploaded") statusText = "Uploaded";
  else if (lowerStatus === "pending") statusText = "Uploaded";

  const participants =
    Array.isArray(dbMeeting.participants) && dbMeeting.participants.length > 0
      ? dbMeeting.participants
      : ["You"];

  const summaryVersion = dbMeeting.summary_versions
    ?.filter((item) => (item.summary || item.content || "").trim() || (Array.isArray(item.overview) && item.overview.length > 0))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const summaryText = (summaryVersion?.summary || summaryVersion?.content || "").trim();
  const overview = Array.isArray(summaryVersion?.overview)
    ? summaryVersion.overview.filter((point): point is string => typeof point === "string" && point.trim().length > 0)
    : [];
  // Build a speaker → color mapping from DB data or palette
  const speakerColorMap = new Map<string, string>();
  let colorIndex = 0;
  for (const seg of (dbMeeting.transcript_segments || [])) {
    const name = seg.speaker || "Speaker";
    if (!speakerColorMap.has(name)) {
      speakerColorMap.set(name, SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length]);
      colorIndex++;
    }
  }

  const transcript = (dbMeeting.transcript_segments || [])
    .slice()
    .sort((a, b) => a.sequence - b.sequence || a.start_time - b.start_time)
    .map((turn) => {
      const speakerName = turn.speaker || "Speaker";
      return {
        id: turn.id,
        speaker: speakerName,
        initials: turn.speaker_initials || speakerName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
        color: speakerColorMap.get(speakerName) || SPEAKER_COLORS[0],
        time: formatTimestamp(turn.start_time),
        text: turn.text,
        startTimeSec: Number(turn.start_time) || 0,
      };
    });
  const actions = (dbMeeting.action_items || []).map((item) => ({
    id: item.id,
    text: item.task || item.text || "Untitled action",
    owner: item.owner || "Unassigned",
    due: item.due_date || (item.due_at ? new Date(item.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No due date"),
    done: item.completed,
  }));
  const highlights = (dbMeeting.highlights || [])
    .slice()
    .sort((a, b) => a.start_timestamp - b.start_timestamp)
    .map((item) => {
      const startSec = Number(item.start_timestamp || item.start_time) || 0;
      const endSec = Number(item.end_timestamp || item.end_time) || startSec;

      const isUser =
        item.kind?.toLowerCase() === "user" ||
        item.kind?.toLowerCase().startsWith("user:") ||
        item.kind?.toLowerCase() === "user_created";

      let highlightText = item.text?.trim();
      if (!highlightText && item.kind && item.kind.startsWith("user:")) {
        try {
          const parsed = JSON.parse(item.kind.slice(5));
          if (parsed.text) highlightText = parsed.text;
        } catch {}
      }
      if (!highlightText && Array.isArray(dbMeeting.transcript_segments)) {
        const matching = dbMeeting.transcript_segments.filter(
          (s) => Math.max(0, s.start_time) >= startSec - 0.5 && Math.max(0, s.start_time) <= endSec + 0.5
        );
        if (matching.length > 0) {
          highlightText = matching.map((s) => s.text).join(" ");
        }
      }

      return {
        id: item.id,
        title: item.title,
        time: formatTimestamp(startSec),
        endTime: endSec > startSec ? formatTimestamp(endSec) : undefined,
        kind: isUser ? "User Highlight" : (item.kind || "Suggested"),
        startTimeSec: startSec,
        endTimeSec: endSec,
        text: highlightText,
        source: (isUser ? "user" : "ai") as "user" | "ai",
      };
    });

  const shareLinks = (dbMeeting.share_links || []).map((link) => {
    let highlightId = link.highlight_id || null;
    if (!highlightId && link.token.startsWith("hl_")) {
      const parts = link.token.split("_");
      if (parts.length >= 3) {
        highlightId = parts[1];
      }
    }
    return {
      id: link.id,
      token: link.token,
      status: link.status,
      is_active: link.is_active !== false && link.status === "active",
      highlightId,
    };
  });

  const activeMeetingShareLink = shareLinks.find(
    (link) => link.is_active && !link.highlightId
  );

  return {
    id: dbMeeting.id,
    title: dbMeeting.title || "Untitled Meeting",
    date: dateFormatted,
    time: timeFormatted,
    duration: durationText,
    attendees: participants,
    category: dbMeeting.source === "upload" ? "Upload" : "Internal",
    status: statusText,
    accent: "blue",
    summary: summaryText || (latestRecording?.r2_object_key ? "Recording uploaded to storage" : "Uploaded recording"),
    overview,
    actions,
    highlights,
    transcript,
    isDemo: false,
    analysisStatus: dbMeeting.status,
    sonioxJobId: dbMeeting.soniox_job_id || latestRecording?.soniox_job_id || dbMeeting.transcription_job_id || undefined,
    summaryAvailable: Boolean(summaryText || overview.length),
    summaryVersion: summaryVersion?.version,
    shareToken: activeMeetingShareLink?.token,
    shareLinks,
  };
}
