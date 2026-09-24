import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return { user, supabase };
    }
  } catch {
    // Session cookies failed, check Authorization header below
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const admin = createAdminClient();
      const { data: { user }, error } = await admin.auth.getUser(token);
      if (!error && user) {
        return { user, supabase: admin };
      }
    }
  }

  return { user: null, supabase: null };
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const meetingId = body.meetingId || body.meeting_id;
    const rawDuration = body.durationSeconds ?? body.duration_seconds ?? body.duration;

    if (!meetingId || typeof meetingId !== "string" || !UUID_REGEX.test(meetingId)) {
      return NextResponse.json(
        { error: "Valid meetingId UUID is required" },
        { status: 400 },
      );
    }

    const durationSeconds =
      typeof rawDuration === "number" && Number.isFinite(rawDuration) && rawDuration > 0 && rawDuration < 2147483647
        ? Math.max(1, Math.round(rawDuration))
        : 0;

    if (durationSeconds <= 0) {
      return NextResponse.json(
        { error: "Valid positive durationSeconds is required" },
        { status: 400 },
      );
    }

    // Check meeting ownership
    const { data: meeting, error: meetErr } = await supabase
      .from("meetings")
      .select("id, user_id, duration, duration_seconds")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetErr || !meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 },
      );
    }

    if (meeting.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: Not meeting owner" },
        { status: 403 },
      );
    }

    // Update meeting duration
    await supabase
      .from("meetings")
      .update({ duration: durationSeconds, duration_seconds: durationSeconds })
      .eq("id", meetingId);

    // Update recording duration
    await supabase
      .from("recordings")
      .update({ duration: durationSeconds, duration_seconds: durationSeconds })
      .eq("meeting_id", meetingId);

    return NextResponse.json({
      success: true,
      meetingId,
      durationSeconds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
