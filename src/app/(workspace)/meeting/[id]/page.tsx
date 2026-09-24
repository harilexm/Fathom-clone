import { notFound } from "next/navigation";
import { MeetingWorkspace } from "@/components/meeting-workspace";
import { findMeeting } from "@/lib/sample-data";
import { createClient } from "@/lib/supabase/server";
import { getLatestRecording, mapDbMeetingToMeeting, type DbMeetingRecord } from "@/lib/meetings";
import { createPresignedDownloadUrl } from "@/lib/r2";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let meeting = findMeeting(id);
  let playbackUrl: string | undefined;
  let recordingMimeType: string | undefined;

  if (meeting) {
    meeting = { ...meeting, isDemo: true };
  } else {
    try {
      const supabase = await createClient();
      const { data: dbMeeting, error } = await supabase
        .from("meetings")
        .select("*, recordings(*), summary_versions(*), transcript_segments(*), action_items(*), highlights(*), share_links(*)")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Database query error for meeting:", error);
      }
      if (dbMeeting) {
        meeting = mapDbMeetingToMeeting(dbMeeting as DbMeetingRecord);
        const recording = getLatestRecording(dbMeeting as DbMeetingRecord);
        if (recording) {
          try {
            playbackUrl = await createPresignedDownloadUrl({ objectKey: recording.r2_object_key });
            recordingMimeType = recording.mime_type;
          } catch (r2Err) {
            console.error("Failed to generate presigned download URL:", r2Err);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load meeting from Supabase:", err);
    }
  }

  if (!meeting) notFound();
  return <MeetingWorkspace key={meeting.id} meeting={meeting} playbackUrl={playbackUrl} recordingMimeType={recordingMimeType} />;
}

