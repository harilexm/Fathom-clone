import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error && user) return { user, supabase };
  } catch {
    // Fall through to bearer token check
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

/**
 * GET /api/meetings/[id]/highlights
 * List all highlights for the meeting
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    if (!meetingId || !UUID_REGEX.test(meetingId)) {
      return NextResponse.json({ error: "Invalid meeting ID" }, { status: 400 });
    }

    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: meeting, error: meetErr } = await supabase
      .from("meetings")
      .select("id, user_id")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetErr || !meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (meeting.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: highlights, error: highErr } = await supabase
      .from("highlights")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("start_timestamp", { ascending: true });

    if (highErr) {
      return NextResponse.json({ error: highErr.message }, { status: 500 });
    }

    return NextResponse.json({ highlights });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/meetings/[id]/highlights
 * Create a user highlight for the meeting.
 * Prevents duplicate highlights at the same timestamp.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    if (!meetingId || !UUID_REGEX.test(meetingId)) {
      return NextResponse.json({ error: "Invalid meeting ID" }, { status: 400 });
    }

    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: meeting, error: meetErr } = await supabase
      .from("meetings")
      .select("id, user_id")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetErr || !meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (meeting.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const rawTitle = typeof body.title === "string" ? body.title.trim() : "";
    const title = rawTitle || "Highlight";
    const startTime = typeof body.startTime === "number" && !isNaN(body.startTime) ? Math.max(0, body.startTime) : 0;
    const rawEndTime = typeof body.endTime === "number" && !isNaN(body.endTime) ? body.endTime : startTime;
    const endTime = Math.max(startTime, rawEndTime);
    const text = typeof body.text === "string" ? body.text.trim() : "";

    // Duplicate prevention: check for existing highlight with same timestamp & title/range
    const { data: existingHighlights, error: existingErr } = await supabase
      .from("highlights")
      .select("id, title, start_timestamp, start_time, end_timestamp, end_time, kind")
      .eq("meeting_id", meetingId);

    if (!existingErr && existingHighlights) {
      const isDuplicate = existingHighlights.some((h) => {
        const hStart = Number(h.start_timestamp ?? h.start_time) || 0;
        const hEnd = Number(h.end_timestamp ?? h.end_time) || 0;
        const startMatches = Math.abs(hStart - startTime) < 0.5;
        const titleMatches = h.title.trim().toLowerCase() === title.toLowerCase();
        const endMatches = Math.abs(hEnd - endTime) < 0.5;
        const isUser = (h.kind?.toLowerCase() === "user" || h.kind?.toLowerCase().startsWith("user:"));
        return (startMatches && titleMatches) || (isUser && startMatches && endMatches);
      });

      if (isDuplicate) {
        return NextResponse.json(
          { error: "A highlight for this moment already exists" },
          { status: 409 }
        );
      }
    }

    // Try inserting with 'text' column
    const rowToInsert: Record<string, unknown> = {
      meeting_id: meetingId,
      title,
      start_timestamp: startTime,
      end_timestamp: endTime,
      start_time: startTime,
      end_time: endTime,
      kind: "user",
      text,
    };

    let insertedHighlight = null;
    const firstInsert = await supabase
      .from("highlights")
      .insert(rowToInsert)
      .select()
      .single();

    if (firstInsert.error) {
      // If the 'text' column doesn't exist yet in the database (PGRST204),
      // fallback to embedding text in kind: user:{"text":"..."}
      if (firstInsert.error.code === "PGRST204" || firstInsert.error.message?.includes("column \"text\"")) {
        delete rowToInsert.text;
        rowToInsert.kind = "user:" + JSON.stringify({ text });
        const fallbackInsert = await supabase
          .from("highlights")
          .insert(rowToInsert)
          .select()
          .single();

        if (fallbackInsert.error) {
          return NextResponse.json(
            { error: `Failed to save highlight: ${fallbackInsert.error.message}` },
            { status: 500 }
          );
        }
        insertedHighlight = fallbackInsert.data;
      } else {
        return NextResponse.json(
          { error: `Failed to save highlight: ${firstInsert.error.message}` },
          { status: 500 }
        );
      }
    } else {
      insertedHighlight = firstInsert.data;
    }

    return NextResponse.json(
      {
        success: true,
        highlight: {
          id: insertedHighlight.id,
          title: insertedHighlight.title,
          start_time: insertedHighlight.start_time,
          end_time: insertedHighlight.end_time,
          start_timestamp: insertedHighlight.start_timestamp,
          end_timestamp: insertedHighlight.end_timestamp,
          startTimeSec: Number(insertedHighlight.start_time || insertedHighlight.start_timestamp) || 0,
          endTimeSec: Number(insertedHighlight.end_time || insertedHighlight.end_timestamp) || 0,
          kind: "User Highlight",
          text,
          source: "user",
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/meetings/[id]/highlights
 * Delete a user highlight from the meeting
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    if (!meetingId || !UUID_REGEX.test(meetingId)) {
      return NextResponse.json({ error: "Invalid meeting ID" }, { status: 400 });
    }

    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: meeting, error: meetErr } = await supabase
      .from("meetings")
      .select("id, user_id")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetErr || !meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (meeting.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let highlightId = searchParams.get("highlightId") || searchParams.get("id");
    if (!highlightId) {
      const body = await request.json().catch(() => null);
      if (body && typeof body.highlightId === "string") {
        highlightId = body.highlightId;
      }
    }

    if (!highlightId || !UUID_REGEX.test(highlightId)) {
      return NextResponse.json({ error: "Invalid highlight ID" }, { status: 400 });
    }

    const { error: deleteErr } = await supabase
      .from("highlights")
      .delete()
      .eq("id", highlightId)
      .eq("meeting_id", meetingId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: highlightId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
