import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  let user = null;
  let supabase = null;

  // 1. Try session cookies
  try {
    const client = await createClient();
    const { data: { user: cookieUser }, error } = await client.auth.getUser();
    if (!error && cookieUser) {
      user = cookieUser;
      supabase = client;
    }
  } catch {
    // Session cookies failed, check Authorization header below
  }

  // 2. Try Authorization: Bearer <token>
  if (!user) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const admin = createAdminClient();
        const { data: { user: tokenUser }, error } = await admin.auth.getUser(token);
        if (!error && tokenUser) {
          user = tokenUser;
          supabase = admin;
        }
      }
    }
  }

  if (!user || !supabase) {
    return NextResponse.json(
      { error: "Unauthorized: Authentication required" },
      { status: 401 },
    );
  }

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select("*, recordings(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  if (meetings && meetings.length > 0) {
    const emptyMeetings = meetings.filter(
      (m) => !Array.isArray(m.participants) || m.participants.length === 0
    );
    if (emptyMeetings.length > 0) {
      const emptyIds = emptyMeetings.map((m) => m.id);
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
  }

  return NextResponse.json({ meetings: meetings || [] });
}
