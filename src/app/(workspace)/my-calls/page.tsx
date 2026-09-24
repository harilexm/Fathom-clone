import { MyCalls } from "@/components/my-calls";
import { createClient } from "@/lib/supabase/server";
import { mapDbMeetingToMeeting, type DbMeetingRecord } from "@/lib/meetings";
import type { Meeting } from "@/lib/sample-data";

export default async function MyCallsPage() {
  let initialMeetings: Meeting[] = [];
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: dbMeetings } = await supabase
        .from("meetings")
        .select("*, recordings(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (dbMeetings) {
        initialMeetings = dbMeetings.map((m: DbMeetingRecord) => mapDbMeetingToMeeting(m));
      }
    }
  } catch {
    // Fallback to client-side loading
  }

  return <MyCalls initialMeetings={initialMeetings} />;
}

