import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMeeting } from "@/lib/sample-data";

async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error && user) return { user, supabase };
  } catch {
    // Session cookies failed, fallback to Bearer header
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const admin = createAdminClient();
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(token);
      if (!error && user) return { user, supabase: admin };
    }
  }

  return { user: null, supabase: null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    if (!meetingId) {
      return NextResponse.json({ error: "Missing meeting ID" }, { status: 400 });
    }

    // 1. Check if it's a sample demo meeting
    const sample = findMeeting(meetingId);
    if (sample) {
      return NextResponse.json({
        meeting: {
          id: sample.id,
          title: sample.title,
          status: sample.status,
          date: sample.date,
          duration: sample.duration,
          attendees: sample.attendees,
          isDemo: true,
        },
      });
    }

    // 2. Check authenticated user
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required" },
        { status: 401 }
      );
    }

    // 3. Fetch from database
    const { data: meeting, error } = await supabase
      .from("meetings")
      .select("id, title, status, duration, duration_seconds, meeting_time, created_at, participants, user_id")
      .eq("id", meetingId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (meeting.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this meeting" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      meeting: {
        id: meeting.id,
        title: meeting.title || "Untitled Meeting",
        status: meeting.status,
        date: meeting.meeting_time || meeting.created_at,
        duration: meeting.duration_seconds || meeting.duration || 0,
        participants: meeting.participants || [],
        isDemo: false,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
