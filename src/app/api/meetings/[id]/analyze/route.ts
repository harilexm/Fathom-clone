import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeMeetingWithOpenAi } from "@/lib/openai";
import { deductProcessingCredits } from "@/lib/credits";

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
 * POST /api/meetings/[id]/analyze
 *
 * Processes a meeting in 'analyzing' status using OpenAI.
 * Reads saved transcript_segments, generates structured summary, key points,
 * decisions, action items, topics, and highlights.
 * Saves results to summary_versions, action_items, and highlights tables.
 * Updates meeting status to 'completed'.
 * Idempotent: deletes any previous generated artifacts on retry before inserting.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;

    if (!meetingId || !UUID_REGEX.test(meetingId)) {
      return NextResponse.json(
        { error: "Invalid meeting ID format" },
        { status: 400 }
      );
    }

    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required" },
        { status: 401 }
      );
    }

    // 1. Fetch meeting and verify ownership
    const { data: meeting, error: meetErr } = await supabase
      .from("meetings")
      .select("id, user_id, title, status, duration, duration_seconds")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetErr || !meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    if (meeting.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this meeting" },
        { status: 403 }
      );
    }

    // 2. Fetch transcript segments
    const { data: segments, error: segErr } = await supabase
      .from("transcript_segments")
      .select("sequence, speaker, text, start_time, end_time")
      .eq("meeting_id", meetingId)
      .order("sequence", { ascending: true });

    if (segErr) {
      return NextResponse.json(
        { error: `Failed to fetch transcript segments: ${segErr.message}` },
        { status: 500 }
      );
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        {
          error:
            "No transcript segments found for this meeting. Run transcription first.",
        },
        { status: 400 }
      );
    }

    // 3. Run OpenAI analysis with structured validation
    const summaryTemplate = user.user_metadata?.summary_template === "concise" ? "concise" : "standard";
    const suggestHighlights = user.user_metadata?.highlight_preference !== "none";
    const analysis = await analyzeMeetingWithOpenAi(
      segments.map((s) => ({
        sequence: s.sequence,
        speaker: s.speaker,
        text: s.text,
        start_time: Number(s.start_time),
        end_time: Number(s.end_time),
      })),
      meeting.title,
      summaryTemplate
    );

    // 4. Persistence with Idempotency (prevent duplicate results on retry)
    // Build overview points from key_points, decisions, and topics for rich display
    const overviewList: string[] = [
      ...analysis.key_points,
      ...analysis.decisions.map((d) => `Decision: ${d}`),
    ];

    // Build extended summary combining overarching summary and key highlights
    const enhancedSummaryText = analysis.summary;

    // A. Summary Versions: Clean up existing standard/enhanced versions and insert
    await supabase
      .from("summary_versions")
      .delete()
      .eq("meeting_id", meetingId);

    const { error: sumErr } = await supabase.from("summary_versions").insert([
      {
        meeting_id: meetingId,
        version: "standard",
        summary_type: "standard",
        summary: enhancedSummaryText,
        content: enhancedSummaryText,
        overview: overviewList,
      },
      {
        meeting_id: meetingId,
        version: "enhanced",
        summary_type: "enhanced",
        summary: enhancedSummaryText,
        content: enhancedSummaryText,
        overview: analysis.key_points,
      },
    ]);

    if (sumErr) {
      console.error("Failed to insert summary_versions:", sumErr);
      return NextResponse.json(
        { error: `Failed to save summary: ${sumErr.message}` },
        { status: 500 }
      );
    }

    // B. Action Items: Clean up existing items and insert
    await supabase.from("action_items").delete().eq("meeting_id", meetingId);

    if (analysis.action_items.length > 0) {
      const actionRows = analysis.action_items.map((item) => ({
        meeting_id: meetingId,
        task: item.task,
        text: item.task,
        owner: item.owner || "Unassigned",
        due_date: item.due_date,
        completed: false,
        is_completed: false,
        done: false,
      }));

      const { error: actErr } = await supabase
        .from("action_items")
        .insert(actionRows);

      if (actErr) {
        console.error("Failed to insert action_items:", actErr);
      }
    }

    // Replace generated suggestions while preserving user-created highlights.
    const { data: previousHighlights, error: previousError } = await supabase
      .from("highlights").select("id, kind").eq("meeting_id", meetingId);
    if (previousError) return NextResponse.json({ error: "Failed to load existing highlights" }, { status: 500 });
    const generatedIds = (previousHighlights ?? [])
      .filter((highlight) => !highlight.kind?.toLowerCase().startsWith("user"))
      .map((highlight) => highlight.id);
    if (generatedIds.length > 0) {
      const { error: deleteError } = await supabase.from("highlights").delete().in("id", generatedIds);
      if (deleteError) return NextResponse.json({ error: "Failed to replace suggested highlights" }, { status: 500 });
    }

    if (suggestHighlights && analysis.highlights.length > 0) {
      const highlightRows = analysis.highlights.map((h) => ({
        meeting_id: meetingId,
        title: h.title,
        start_timestamp: h.start_timestamp,
        end_timestamp: h.end_timestamp,
        start_time: h.start_timestamp,
        end_time: h.end_timestamp,
        kind: h.kind || "Highlight",
      }));

      const { error: highErr } = await supabase
        .from("highlights")
        .insert(highlightRows);

      if (highErr) {
        console.error("Failed to insert highlights:", highErr);
      }
    }

    // D. Update meeting status to completed (with fallback to ready if migration constraint requires) and persist participants
    let finalStatus = "completed";
    const nowIso = new Date().toISOString();
    const finalParticipants =
      analysis.participants && analysis.participants.length > 0
        ? analysis.participants
        : Array.from(new Set(segments.map((s) => s.speaker?.trim()).filter(Boolean)));

    const { error: updateMeetErr } = await supabase
      .from("meetings")
      .update({
        status: "completed",
        participants: finalParticipants,
        updated_at: nowIso,
      })
      .eq("id", meetingId);

    if (updateMeetErr) {
      console.warn(
        "Could not set status to 'completed' (constraint may need migration), falling back to 'ready':",
        updateMeetErr.message
      );
      finalStatus = "ready";
      await supabase
        .from("meetings")
        .update({
          status: "ready",
          participants: finalParticipants,
          updated_at: nowIso,
        })
        .eq("id", meetingId);
    }

    // Also update recording status to ready
    await supabase
      .from("recordings")
      .update({
        status: "ready",
        updated_at: nowIso,
      })
      .eq("meeting_id", meetingId);

    // E. Ensure media-processing credits are deducted idempotently (if not already charged in transcription)
    const effectiveDuration =
      meeting.duration_seconds ||
      meeting.duration ||
      (segments.length > 0 ? Math.ceil(segments[segments.length - 1].end_time) : 0);

    const creditResult = await deductProcessingCredits({
      userId: meeting.user_id,
      meetingId,
      durationSeconds: effectiveDuration,
    });

    return NextResponse.json({
      success: true,
      meetingId,
      status: finalStatus,
      creditsDeducted: creditResult.deducted,
      creditsBalance: creditResult.balance,
      alreadyCharged: creditResult.alreadyCharged,
      analysis: {
        summary: analysis.summary,
        keyPointsCount: analysis.key_points.length,
        decisionsCount: analysis.decisions.length,
        actionItemsCount: analysis.action_items.length,
        topicsCount: analysis.topics.length,
        highlightsCount: suggestHighlights ? analysis.highlights.length : 0,
        actionItems: analysis.action_items,
        decisions: analysis.decisions,
        topics: analysis.topics,
        highlights: suggestHighlights ? analysis.highlights : [],
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = POST;
