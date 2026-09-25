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

      if (dbMeetings && dbMeetings.length > 0) {
        // Self-healing: if any meeting has no participants stored, resolve from transcript segments
        const emptyMeetings = dbMeetings.filter(
          (m: DbMeetingRecord) => !Array.isArray(m.participants) || m.participants.length === 0
        );
        if (emptyMeetings.length > 0) {
          const emptyIds = emptyMeetings.map((m: DbMeetingRecord) => m.id);
          const { data: segs } = await supabase
            .from("transcript_segments")
            .select("meeting_id, speaker")
            .in("meeting_id", emptyIds);

          if (segs && segs.length > 0) {
            const speakersMap = new Map<string, Set<string>>();
            for (const s of segs) {
              const spk = (s.speaker || "").trim();
              if (!spk) continue;
              if (!speakersMap.has(s.meeting_id)) speakersMap.set(s.meeting_id, new Set());
              speakersMap.get(s.meeting_id)!.add(spk);
            }

            for (const m of emptyMeetings) {
              const foundSpeakers = Array.from(speakersMap.get(m.id) || []);
              if (foundSpeakers.length > 0) {
                m.participants = foundSpeakers;
                supabase.from("meetings").update({ participants: foundSpeakers }).eq("id", m.id).then();
              }
            }
          }
        }

        initialMeetings = dbMeetings.map((m: DbMeetingRecord) => mapDbMeetingToMeeting(m));
      }
    }
  } catch {
    // Fallback to client-side loading
  }

  return <MyCalls initialMeetings={initialMeetings} />;
}

