import { notFound } from "next/navigation";
import { findMeeting, meetings, type Highlight } from "@/lib/sample-data";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mapDbMeetingToMeeting,
  getLatestRecording,
  formatMeetingDate,
  formatTimestamp,
  type DbMeetingRecord,
} from "@/lib/meetings";
import { createPresignedDownloadUrl } from "@/lib/r2";
import {
  PublicSharedMeetingWorkspace,
  PublicSharedHighlightWorkspace,
  RevokedShareLinkNotice,
} from "@/components/public-share-workspace";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // 1. Handle sample fixture preview tokens
  if (token === "sample-preview" || token.startsWith("sample-")) {
    const sampleMeeting =
      token === "sample-preview"
        ? meetings[0]
        : findMeeting(token.slice(7));
    if (!sampleMeeting) notFound();
    return <PublicSharedMeetingWorkspace meeting={sampleMeeting} />;
  }

  // 2. Query share_links from database using admin client (server-side only)
  try {
    const admin = createAdminClient();
    const { data: shareLink, error: shareErr } = await admin
      .from("share_links")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (shareErr) {
      console.error("Error looking up share link:", shareErr);
      notFound();
    }

    if (!shareLink) {
      notFound();
    }

    // 3. If link is revoked or not active, display private/revoked notice
    const isLinkActive =
      shareLink.status === "active" &&
      shareLink.is_active !== false &&
      !shareLink.revoked_at;

    if (!isLinkActive) {
      return <RevokedShareLinkNotice />;
    }

    // 4. Check if this is a highlight share link
    let highlightId = (shareLink as { highlight_id?: string | null }).highlight_id || null;
    if (!highlightId && token.startsWith("hl_")) {
      const parts = token.split("_");
      if (parts.length >= 3) {
        highlightId = parts[1];
      }
    }

    // Case A: Highlight Share Link
    if (highlightId) {
      const [meetingRes, highlightRes] = await Promise.all([
        admin
          .from("meetings")
          .select("*, recordings(*), transcript_segments(*)")
          .eq("id", shareLink.meeting_id)
          .maybeSingle(),
        admin
          .from("highlights")
          .select("*")
          .eq("id", highlightId)
          .eq("meeting_id", shareLink.meeting_id)
          .maybeSingle(),
      ]);

      const dbMeeting = meetingRes.data as DbMeetingRecord | null;
      const dbHighlight = highlightRes.data;

      if (!dbMeeting || !dbHighlight) {
        notFound();
      }

      // Generate presigned playback URL if recording exists
      let playbackUrl: string | undefined;
      let recordingMimeType: string | undefined;
      const recording = getLatestRecording(dbMeeting);
      if (recording?.r2_object_key) {
        try {
          playbackUrl = await createPresignedDownloadUrl({
            objectKey: recording.r2_object_key,
            expiresIn: 3600,
          });
          recordingMimeType = recording.mime_type;
        } catch (r2Err) {
          console.error("Failed to generate download url for highlight share:", r2Err);
        }
      }

      const startSec = Number(dbHighlight.start_timestamp ?? dbHighlight.start_time) || 0;
      const endSec = Number(dbHighlight.end_timestamp ?? dbHighlight.end_time) || startSec;

      let quoteText = dbHighlight.text?.trim();
      if (!quoteText && dbHighlight.kind && dbHighlight.kind.startsWith("user:")) {
        try {
          const parsed = JSON.parse(dbHighlight.kind.slice(5));
          if (parsed.text) quoteText = parsed.text;
        } catch {}
      }
      if (!quoteText && Array.isArray(dbMeeting.transcript_segments)) {
        const matching = dbMeeting.transcript_segments.filter(
          (s) => Math.max(0, s.start_time) >= startSec - 0.5 && Math.max(0, s.start_time) <= endSec + 0.5
        );
        if (matching.length > 0) {
          quoteText = matching.map((s) => s.text).join(" ");
        }
      }

      const isUser =
        dbHighlight.kind?.toLowerCase() === "user" ||
        dbHighlight.kind?.toLowerCase().startsWith("user:") ||
        dbHighlight.kind?.toLowerCase() === "user_created";

      const mappedHighlight: Highlight = {
        id: dbHighlight.id,
        title: dbHighlight.title,
        time: formatTimestamp(startSec),
        endTime: endSec > startSec ? formatTimestamp(endSec) : undefined,
        kind: isUser ? "User Highlight" : (dbHighlight.kind || "Suggested"),
        startTimeSec: startSec,
        endTimeSec: endSec,
        text: quoteText,
        source: (isUser ? "user" : "ai") as "user" | "ai",
      };

      const meetingDateStr = formatMeetingDate(dbMeeting.meeting_time || dbMeeting.created_at);

      return (
        <PublicSharedHighlightWorkspace
          meetingTitle={dbMeeting.title || "Untitled Meeting"}
          meetingDate={meetingDateStr}
          highlight={mappedHighlight}
          playbackUrl={playbackUrl}
          recordingMimeType={recordingMimeType}
        />
      );
    }

    // Case B: Entire Meeting Share Link
    const { data: dbMeeting, error: meetErr } = await admin
      .from("meetings")
      .select("*, recordings(*), summary_versions(*), transcript_segments(*), action_items(*), highlights(*), share_links(*)")
      .eq("id", shareLink.meeting_id)
      .maybeSingle();

    if (meetErr || !dbMeeting) {
      notFound();
    }

    const meeting = mapDbMeetingToMeeting(dbMeeting as DbMeetingRecord);

    let playbackUrl: string | undefined;
    let recordingMimeType: string | undefined;
    const recording = getLatestRecording(dbMeeting as DbMeetingRecord);
    if (recording?.r2_object_key) {
      try {
        playbackUrl = await createPresignedDownloadUrl({
          objectKey: recording.r2_object_key,
          expiresIn: 3600,
        });
        recordingMimeType = recording.mime_type;
      } catch (r2Err) {
        console.error("Failed to generate presigned download URL for meeting share:", r2Err);
      }
    }

    return (
      <PublicSharedMeetingWorkspace
        meeting={meeting}
        playbackUrl={playbackUrl}
        recordingMimeType={recordingMimeType}
      />
    );
  } catch (err) {
    console.error("Unexpected error in share page:", err);
    notFound();
  }
}
