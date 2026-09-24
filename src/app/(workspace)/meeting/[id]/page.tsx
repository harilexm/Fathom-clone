import { notFound } from "next/navigation";
import { MeetingWorkspace } from "@/components/meeting-workspace";
import { findMeeting } from "@/lib/sample-data";
import { createClient } from "@/lib/supabase/server";
import { mapDbMeetingToMeeting, type DbMeetingRecord } from "@/lib/meetings";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let meeting = findMeeting(id);

  if (!meeting) {
    try {
      const supabase = await createClient();
      const { data: dbMeeting } = await supabase
        .from("meetings")
        .select("*, recordings(*)")
        .eq("id", id)
        .maybeSingle();

      if (dbMeeting) {
        meeting = mapDbMeetingToMeeting(dbMeeting as DbMeetingRecord);
      }
    } catch {
      // Failed to load from database
    }
  }

  if (!meeting) notFound();
  return <MeetingWorkspace key={meeting.id} meeting={meeting} />;
}

