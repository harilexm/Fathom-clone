import type { Meeting } from "@/lib/sample-data";

export interface DbMeetingRecord {
  id: string;
  user_id: string;
  title: string;
  source: string;
  status: string;
  duration?: number;
  duration_seconds?: number;
  participants?: string[] | null;
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
    created_at: string;
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
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours} hr ${remainingMins} min` : `${hours} hr`;
}

export function mapDbMeetingToMeeting(dbMeeting: DbMeetingRecord): Meeting {
  const latestRecording = dbMeeting.recordings && dbMeeting.recordings.length > 0
    ? dbMeeting.recordings[0]
    : undefined;

  const dateStr = dbMeeting.created_at || new Date().toISOString();
  const dateFormatted = formatMeetingDate(dateStr);
  const timeFormatted = formatMeetingTime(dateStr);

  const durationSec =
    dbMeeting.duration_seconds ||
    dbMeeting.duration ||
    latestRecording?.duration_seconds ||
    latestRecording?.duration;
  const durationText = formatMeetingDuration(durationSec);

  // Status mapping
  const rawStatus = latestRecording?.status || dbMeeting.status || "uploaded";
  let statusText = "Uploaded";
  const lowerStatus = rawStatus.toLowerCase();
  if (lowerStatus === "ready") statusText = "Ready";
  else if (lowerStatus === "processing") statusText = "Processing";
  else if (lowerStatus === "failed") statusText = "Failed";
  else if (lowerStatus === "uploaded") statusText = "Uploaded";
  else if (lowerStatus === "pending") statusText = "Uploaded";

  const participants =
    Array.isArray(dbMeeting.participants) && dbMeeting.participants.length > 0
      ? dbMeeting.participants
      : ["You"];

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
    summary: latestRecording?.r2_object_key ? "Recording uploaded to storage" : "Uploaded recording",
    overview: [],
    actions: [],
    highlights: [],
    transcript: [],
    isDemo: false,
  };
}
