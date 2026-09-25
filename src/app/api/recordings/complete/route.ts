import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2Client, getR2Config, createPresignedDownloadUrl } from "@/lib/r2";
import { probeR2MediaDuration } from "@/lib/media-duration";
import { submitSonioxAsyncTranscription } from "@/lib/soniox";
import { calculateCreditsRequired, checkUserCredits } from "@/lib/credits";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getAuthenticatedUser(request: NextRequest) {
  // 1. Try session cookies
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      return { user, supabase };
    }
  } catch {
    // Session cookies failed, check Authorization header below
  }

  // 2. Try Authorization: Bearer <token>
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

function formatTitleFromFilename(filename?: string): string {
  if (!filename || !filename.trim()) return "Uploaded Meeting";
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const formatted = nameWithoutExt.replace(/[-_]+/g, " ").trim();
  return formatted || "Uploaded Meeting";
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

    const objectKey =
      (typeof body.objectKey === "string" ? body.objectKey : null) ||
      (typeof body.r2_object_key === "string" ? body.r2_object_key : null);

    if (!objectKey || !objectKey.trim()) {
      return NextResponse.json(
        { error: "Missing required parameter: objectKey" },
        { status: 400 },
      );
    }

    // Key format: recordings/${userId}/${meetingId}/${timestamp}-${uuid}.${ext}
    const keyParts = objectKey.split("/");
    if (keyParts.length < 4 || keyParts[0] !== "recordings") {
      return NextResponse.json(
        { error: "Invalid R2 object key format" },
        { status: 400 },
      );
    }

    const keyUserId = keyParts[1];
    const keyMeetingId = keyParts[2];

    // Security: object key must belong to the authenticated user
    if (keyUserId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: Object key does not belong to authenticated user" },
        { status: 403 },
      );
    }

    // Validation: keyMeetingId must be a valid UUID format
    if (!UUID_REGEX.test(keyMeetingId)) {
      return NextResponse.json(
        { error: "Invalid meetingId in object key. Must be a valid UUID." },
        { status: 400 },
      );
    }

    // Verify that the object actually exists in Cloudflare R2
    const r2Client = getR2Client();
    const { bucketName } = getR2Config();

    let headResult;
    try {
      headResult = await r2Client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        }),
      );
    } catch {
      return NextResponse.json(
        { error: "Verification failed: Uploaded file not found in storage" },
        { status: 404 },
      );
    }

    const filename = typeof body.filename === "string" ? body.filename : undefined;
    const title = typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : formatTitleFromFilename(filename);

    const mimeType =
      (typeof body.mimeType === "string" ? body.mimeType : null) ||
      (typeof body.contentType === "string" ? body.contentType : null) ||
      headResult.ContentType ||
      "video/mp4";

    const fileSize =
      typeof body.size === "number" && body.size > 0
        ? body.size
        : typeof body.size_bytes === "number" && body.size_bytes > 0
          ? body.size_bytes
          : headResult.ContentLength || 0;

    const requestedDuration = body.durationSeconds ?? body.duration_seconds;
    let durationSeconds = typeof requestedDuration === "number" &&
      Number.isFinite(requestedDuration) && requestedDuration > 0 && requestedDuration < 2147483647
      ? Math.max(1, Math.round(requestedDuration))
      : 0;

    // Server-side fallback: If client could not determine duration (e.g. streaming fMP4/WebM),
    // probe Cloudflare R2 storage directly using minimal byte range requests
    if (durationSeconds <= 0) {
      try {
        const probed = await probeR2MediaDuration(objectKey, fileSize);
        if (typeof probed === "number" && probed > 0) {
          durationSeconds = probed;
        }
      } catch (probeErr) {
        console.warn("Server-side duration probe skipped/failed:", probeErr);
      }
    }

    // Idempotency check: If a recording for this exact objectKey already exists, return it idempotently
    const { data: existingRecording } = await supabase
      .from("recordings")
      .select("*")
      .eq("r2_object_key", objectKey)
      .maybeSingle();

    if (existingRecording) {
      // If duration was probed or discovered now but recording/meeting had 0:
      if (durationSeconds > 0 && (!existingRecording.duration || existingRecording.duration <= 0)) {
        await supabase
          .from("recordings")
          .update({ duration: durationSeconds, duration_seconds: durationSeconds })
          .eq("id", existingRecording.id);
        await supabase
          .from("meetings")
          .update({ duration: durationSeconds, duration_seconds: durationSeconds })
          .eq("id", existingRecording.meeting_id);
      }

      const { data: currentMeeting } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", existingRecording.meeting_id)
        .maybeSingle();

      return NextResponse.json(
        {
          success: true,
          meeting: currentMeeting || { id: existingRecording.meeting_id, user_id: user.id, title, status: "pending", duration: durationSeconds, duration_seconds: durationSeconds },
          recording: { ...existingRecording, duration: durationSeconds || existingRecording.duration, duration_seconds: durationSeconds || existingRecording.duration_seconds },
        },
        { status: 200 },
      );
    }

    // Check if meeting already exists (e.g. if pre-created)
    const { data: existingMeeting } = await supabase
      .from("meetings")
      .select("id, user_id, title")
      .eq("id", keyMeetingId)
      .maybeSingle();

    let meetingRecord;

    if (existingMeeting) {
      if (existingMeeting.user_id !== user.id) {
        return NextResponse.json(
          { error: "Forbidden: Meeting belongs to another user" },
          { status: 403 },
        );
      }
      if (durationSeconds > 0) {
        const { data: updatedMeeting } = await supabase
          .from("meetings")
          .update({ duration: durationSeconds, duration_seconds: durationSeconds })
          .eq("id", existingMeeting.id)
          .select()
          .single();
        meetingRecord = updatedMeeting || existingMeeting;
      } else {
        meetingRecord = existingMeeting;
      }
    } else {
      // Create new meeting record using upsert on id to avoid race collisions
      const { data: newMeeting, error: meetErr } = await supabase
        .from("meetings")
        .upsert(
          {
            id: keyMeetingId,
            user_id: user.id,
            title,
            source: "upload",
            status: "pending",
            duration: durationSeconds,
            duration_seconds: durationSeconds,
          },
          { onConflict: "id" }
        )
        .select()
        .single();

      if (meetErr || !newMeeting) {
        return NextResponse.json(
          { error: meetErr?.message || "Failed to create meeting record" },
          { status: 500 },
        );
      }
      meetingRecord = newMeeting;
    }

    // Create recording record with status = 'uploaded'
    const { data: recordingRecord, error: recErr } = await supabase
      .from("recordings")
      .insert({
        meeting_id: meetingRecord.id,
        r2_object_key: objectKey,
        mime_type: mimeType,
        size: fileSize,
        size_bytes: fileSize,
        duration: durationSeconds,
        duration_seconds: durationSeconds,
        status: "uploaded",
      })
      .select()
      .single();

    if (recErr || !recordingRecord) {
      return NextResponse.json(
        { error: recErr?.message || "Failed to create recording record" },
        { status: 500 },
      );
    }

    // Check user credits before automatic media processing starts
    const creditsRequired = calculateCreditsRequired(durationSeconds);
    const creditCheck = await checkUserCredits(user.id, creditsRequired, durationSeconds);

    let processingBlocked = false;
    let processingMessage: string | undefined;

    if (!creditCheck.hasEnough) {
      processingBlocked = true;
      processingMessage = creditCheck.error;
      console.warn(`Transcription auto-dispatch blocked for user ${user.id}: ${creditCheck.error}`);

      if (body.enforceCredits === true) {
        return NextResponse.json(
          {
            error: creditCheck.error,
            creditsRequired,
            creditsBalance: creditCheck.balance,
            durationSeconds,
          },
          { status: 402 }
        );
      }
    } else {
      // Trigger Soniox async speech-to-text transcription
      try {
        const downloadUrl = await createPresignedDownloadUrl({
          objectKey,
          expiresIn: 3600,
        });

        const sonioxJob = await submitSonioxAsyncTranscription({
          audioUrl: downloadUrl,
          clientReferenceId: `meeting_${meetingRecord.id}`,
          enableSpeakerDiarization: true,
        });

        if (sonioxJob?.id) {
          const nowIso = new Date().toISOString();
          const { data: transcribingMeeting } = await supabase
            .from("meetings")
            .update({
              status: "transcribing",
              soniox_job_id: sonioxJob.id,
              transcription_job_id: sonioxJob.id,
              updated_at: nowIso,
            })
            .eq("id", meetingRecord.id)
            .select()
            .single();

          await supabase
            .from("recordings")
            .update({
              status: "transcribing",
              soniox_job_id: sonioxJob.id,
              transcription_job_id: sonioxJob.id,
              updated_at: nowIso,
            })
            .eq("id", recordingRecord.id);

          if (transcribingMeeting) {
            meetingRecord = transcribingMeeting;
          } else {
            meetingRecord.status = "transcribing";
          }
          recordingRecord.status = "transcribing";
        }
      } catch (sonioxErr) {
        console.warn("Async Soniox transcription auto-dispatch deferred/failed:", sonioxErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        meeting: meetingRecord,
        recording: recordingRecord,
        processingBlocked,
        creditsRequired,
        creditsBalance: creditCheck.balance,
        ...(processingMessage ? { warning: processingMessage } : {}),
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
