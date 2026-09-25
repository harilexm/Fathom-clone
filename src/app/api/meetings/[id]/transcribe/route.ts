import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPresignedDownloadUrl } from "@/lib/r2";
import { submitSonioxAsyncTranscription, getSonioxTranscriptionStatus } from "@/lib/soniox";
import { calculateCreditsRequired, checkUserCredits, getUserCreditsBalance } from "@/lib/credits";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getAuthenticatedUser(request: NextRequest) {
  // 1. Session cookies
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error && user) {
      return { user, supabase };
    }
  } catch {
    // Session cookies failed, check Bearer header below
  }

  // 2. Authorization: Bearer <token>
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const admin = createAdminClient();
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(token);
      if (!error && user) {
        return { user, supabase: admin };
      }
    }
  }

  return { user: null, supabase: null };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;

    if (!meetingId || !UUID_REGEX.test(meetingId)) {
      return NextResponse.json(
        { error: "Invalid meeting ID. Must be a valid UUID." },
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

    // 1. Verify meeting exists
    const { data: meeting, error: meetErr } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetErr || !meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    // 2. Security: Verify the authenticated user owns it
    if (meeting.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this meeting" },
        { status: 403 }
      );
    }

    // Idempotency: If already submitted and status is transcribing, return existing job ID
    if (meeting.soniox_job_id && meeting.status === "transcribing") {
      return NextResponse.json(
        {
          success: true,
          jobId: meeting.soniox_job_id,
          status: "transcribing",
          message: "Transcription is already in progress for this meeting",
          meeting,
        },
        { status: 200 }
      );
    }

    // 3. Find the latest recording for this meeting
    const { data: recording, error: recErr } = await supabase
      .from("recordings")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recErr || !recording || !recording.r2_object_key) {
      return NextResponse.json(
        { error: "No recording found for this meeting to transcribe" },
        { status: 400 }
      );
    }

    // 4. Verify user has enough credits before processing starts
    // Rule: 1 started minute = 1 credit, credits_required = ceil(duration_seconds / 60)
    const durationSeconds =
      meeting.duration_seconds ||
      meeting.duration ||
      recording.duration_seconds ||
      recording.duration ||
      0;
    const creditsRequired = calculateCreditsRequired(durationSeconds);
    const creditCheck = await checkUserCredits(user.id, creditsRequired, durationSeconds);

    if (!creditCheck.hasEnough) {
      return NextResponse.json(
        {
          error: creditCheck.error || "Insufficient credits to process this meeting",
          creditsRequired,
          creditsBalance: creditCheck.balance,
          durationSeconds,
        },
        { status: 402 }
      );
    }

    // 5. Generate temporary signed R2 GET URL (valid for 1 hour)
    const signedDownloadUrl = await createPresignedDownloadUrl({
      objectKey: recording.r2_object_key,
      expiresIn: 3600,
    });

    // 6. Submit recording to Soniox async STT with speaker diarization and timestamps
    const sonioxResponse = await submitSonioxAsyncTranscription({
      audioUrl: signedDownloadUrl,
      clientReferenceId: `meeting_${meeting.id}`,
      enableSpeakerDiarization: true,
    });

    const jobId = sonioxResponse.id;
    if (!jobId) {
      return NextResponse.json(
        { error: "Soniox accepted request but did not return a valid job ID" },
        { status: 502 }
      );
    }

    // 6. Store the Soniox transcription/job ID and change meeting status from uploaded → transcribing
    const nowIso = new Date().toISOString();

    const { data: updatedMeeting, error: updateMeetErr } = await supabase
      .from("meetings")
      .update({
        status: "transcribing",
        soniox_job_id: jobId,
        transcription_job_id: jobId,
        updated_at: nowIso,
      })
      .eq("id", meetingId)
      .select()
      .single();

    if (updateMeetErr) {
      console.error("Failed to update meeting status:", updateMeetErr);
      return NextResponse.json(
        { error: `Failed to update meeting record: ${updateMeetErr.message}` },
        { status: 500 }
      );
    }

    // Also update recording record status and job ID
    await supabase
      .from("recordings")
      .update({
        status: "transcribing",
        soniox_job_id: jobId,
        transcription_job_id: jobId,
        updated_at: nowIso,
      })
      .eq("id", recording.id);

    return NextResponse.json(
      {
        success: true,
        jobId,
        status: "transcribing",
        sonioxStatus: sonioxResponse.status,
        meeting: updatedMeeting,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(
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
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: meeting, error: meetErr } = await supabase
      .from("meetings")
      .select("id, user_id, status, soniox_job_id, transcription_job_id, duration, duration_seconds")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetErr || !meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (meeting.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const durationSeconds =
      meeting.duration_seconds || meeting.duration || 0;
    const creditsRequired = calculateCreditsRequired(durationSeconds);
    const userCredits = await getUserCreditsBalance(user.id);

    const jobId = meeting.soniox_job_id || meeting.transcription_job_id;
    if (!jobId) {
      return NextResponse.json({
        meetingId,
        status: meeting.status,
        jobId: null,
        durationSeconds,
        creditsRequired,
        creditsBalance: userCredits,
        hasEnoughCredits: userCredits >= creditsRequired,
      });
    }

    const sonioxStatus = await getSonioxTranscriptionStatus(jobId);

    return NextResponse.json({
      meetingId,
      status: meeting.status,
      jobId,
      sonioxStatus,
      durationSeconds,
      creditsRequired,
      creditsBalance: userCredits,
      hasEnoughCredits: userCredits >= creditsRequired,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
