import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSonioxTranscriptionStatus,
  getSonioxTranscript,
  aggregateTokensToSegments,
} from "@/lib/soniox";
import { deductProcessingCredits, hasMeetingBeenCharged } from "@/lib/credits";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Speaker initials derived from "Speaker N" labels. */
function speakerInitials(speaker: string): string {
  return speaker
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Simple rotating color palette for speaker avatars. */
const SPEAKER_COLORS = [
  "#214656",
  "#3b4f6b",
  "#4a3f6b",
  "#5c3d5e",
  "#3b5e4f",
  "#6b4f3b",
  "#4a5e3b",
  "#5e3b4a",
];

async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error && user) return { user, supabase };
  } catch {
    // Fall through to bearer token
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
 * POST /api/meetings/[id]/transcribe/complete
 *
 * Checks the Soniox job status for the given meeting.
 * When completed:
 *   1. Fetches the full transcript
 *   2. Aggregates word tokens into speaker turn segments
 *   3. Inserts segments into transcript_segments (with dedup)
 *   4. Updates meeting status to "analyzing"
 * When still processing: returns current status without changes.
 * On Soniox failure: sets meeting status to "failed" with error info.
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
      .select("id, user_id, status, soniox_job_id, transcription_job_id, duration, duration_seconds")
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

    const jobId = meeting.soniox_job_id || meeting.transcription_job_id;
    if (!jobId) {
      return NextResponse.json(
        { error: "No Soniox transcription job found for this meeting. Submit a transcription first." },
        { status: 400 }
      );
    }

    // Idempotency: If meeting is already past transcribing (analyzing/ready), return early
    if (meeting.status === "analyzing" || meeting.status === "ready" || meeting.status === "completed") {
      const { count } = await supabase
        .from("transcript_segments")
        .select("id", { count: "exact", head: true })
        .eq("meeting_id", meetingId);

      const alreadyCharged = await hasMeetingBeenCharged(meetingId);

      return NextResponse.json({
        success: true,
        meetingId,
        status: meeting.status,
        jobId,
        segmentCount: count || 0,
        alreadyCharged,
        creditsDeducted: 0,
        message: `Transcript already saved. Meeting status: ${meeting.status}`,
      });
    }

    // 2. Check Soniox job status
    const sonioxStatus = await getSonioxTranscriptionStatus(jobId);

    if (sonioxStatus.status === "error" || sonioxStatus.status === "failed") {
      // Set meeting to failed with error info
      const errorMessage =
        sonioxStatus.error || sonioxStatus.message || "Soniox transcription failed";

      await supabase
        .from("meetings")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", meetingId);

      return NextResponse.json(
        {
          success: false,
          meetingId,
          status: "failed",
          jobId,
          error: errorMessage,
          sonioxStatus: sonioxStatus.status,
        },
        { status: 200 }
      );
    }

    if (sonioxStatus.status !== "completed") {
      // Still processing — return current status without changes
      return NextResponse.json({
        success: false,
        meetingId,
        status: meeting.status,
        jobId,
        sonioxStatus: sonioxStatus.status,
        message: `Transcription is still ${sonioxStatus.status}. Try again later.`,
      });
    }

    // 3. Job completed — fetch the full transcript
    const transcript = await getSonioxTranscript(jobId);

    if (!transcript.tokens || transcript.tokens.length === 0) {
      await supabase
        .from("meetings")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", meetingId);

      return NextResponse.json(
        {
          success: false,
          meetingId,
          status: "failed",
          jobId,
          error: "Soniox returned an empty transcript (no tokens)",
        },
        { status: 200 }
      );
    }

    // 4. Aggregate word tokens into speaker turn segments
    const segments = aggregateTokensToSegments(transcript.tokens);

    if (segments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          meetingId,
          status: "failed",
          jobId,
          error: "Token aggregation produced zero segments",
        },
        { status: 200 }
      );
    }

    // 5. Dedup: check if segments already exist for this meeting
    const { count: existingCount } = await supabase
      .from("transcript_segments")
      .select("id", { count: "exact", head: true })
      .eq("meeting_id", meetingId);

    if (existingCount && existingCount > 0) {
      // Segments already exist — skip insertion, just ensure status is updated
      await supabase
        .from("meetings")
        .update({
          status: "analyzing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", meetingId);

      return NextResponse.json({
        success: true,
        meetingId,
        status: "analyzing",
        jobId,
        segmentCount: existingCount,
        message: "Transcript segments already existed. Status updated to analyzing.",
      });
    }

    // 6. Get the recording ID and duration for FK reference
    const { data: recording } = await supabase
      .from("recordings")
      .select("id, duration, duration_seconds")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 7. Insert all segments in batches (Supabase has row limits per insert)
    const BATCH_SIZE = 50;
    let totalInserted = 0;

    for (let i = 0; i < segments.length; i += BATCH_SIZE) {
      const batch = segments.slice(i, i + BATCH_SIZE).map((seg) => ({
        meeting_id: meetingId,
        recording_id: recording?.id || null,
        speaker: seg.speaker,
        speaker_initials: speakerInitials(seg.speaker),
        speaker_color: SPEAKER_COLORS[
          (parseInt(seg.speaker.replace(/\D/g, "") || "0", 10) - 1) %
            SPEAKER_COLORS.length
        ],
        text: seg.text,
        start_time: seg.start_time,
        end_time: seg.end_time,
        sequence: seg.sequence,
        sequence_number: seg.sequence,
      }));

      const { error: insertErr, data: insertedData } = await supabase
        .from("transcript_segments")
        .insert(batch)
        .select("id");

      if (insertErr) {
        console.error(
          `Failed to insert transcript segment batch ${i}-${i + batch.length}:`,
          insertErr
        );
        // Mark meeting as failed so we don't end up in a partial state
        await supabase
          .from("meetings")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", meetingId);

        return NextResponse.json(
          {
            success: false,
            meetingId,
            status: "failed",
            jobId,
            error: `Failed to insert segment batch: ${insertErr.message}`,
            insertedSoFar: totalInserted,
          },
          { status: 500 }
        );
      }

      totalInserted += insertedData?.length || batch.length;
    }

    // 8. Update meeting status to "analyzing" and store detected speakers
    const distinctSpeakers = Array.from(
      new Set(segments.map((s) => s.speaker?.trim()).filter(Boolean))
    );

    const updatePayload: Record<string, unknown> = {
      status: "analyzing",
      updated_at: new Date().toISOString(),
    };
    if (distinctSpeakers.length > 0) {
      updatePayload.participants = distinctSpeakers;
    }

    const { error: updateErr } = await supabase
      .from("meetings")
      .update(updatePayload)
      .eq("id", meetingId);

    if (updateErr) {
      console.error("Failed to update meeting status to analyzing:", updateErr);
    }

    // Also update recording status
    if (recording?.id) {
      await supabase
        .from("recordings")
        .update({
          status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", recording.id);
    }

    // 9. Processing completed successfully: Deduct credits once idempotently
    // Rule: 1 started minute = 1 credit, credits_required = ceil(duration_seconds / 60)
    // Retries, duplicate webhooks or refreshes can never charge twice
    const maxSegmentEnd =
      segments.length > 0 ? Math.ceil(segments[segments.length - 1].end_time) : 0;
    const effectiveDuration =
      meeting.duration_seconds ||
      meeting.duration ||
      recording?.duration_seconds ||
      recording?.duration ||
      maxSegmentEnd;

    const creditResult = await deductProcessingCredits({
      userId: meeting.user_id,
      meetingId,
      durationSeconds: effectiveDuration,
      recordingId: recording?.id,
    });

    return NextResponse.json({
      success: true,
      meetingId,
      status: "analyzing",
      jobId,
      segmentCount: totalInserted,
      speakerCount: new Set(segments.map((s) => s.speaker)).size,
      creditsDeducted: creditResult.deducted,
      creditsBalance: creditResult.balance,
      alreadyCharged: creditResult.alreadyCharged,
      transactionId: creditResult.transactionId,
      message: `Saved ${totalInserted} transcript segments from ${new Set(segments.map((s) => s.speaker)).size} speakers.`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = POST;
