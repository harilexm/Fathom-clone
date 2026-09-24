import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2Client, getR2Config } from "@/lib/r2";
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

    // Idempotency check: If a recording for this exact objectKey already exists, return it idempotently
    const { data: existingRecording } = await supabase
      .from("recordings")
      .select("*")
      .eq("r2_object_key", objectKey)
      .maybeSingle();

    if (existingRecording) {
      const { data: currentMeeting } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", existingRecording.meeting_id)
        .maybeSingle();

      return NextResponse.json(
        {
          success: true,
          meeting: currentMeeting || { id: existingRecording.meeting_id, user_id: user.id, title, status: "pending" },
          recording: existingRecording,
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
      meetingRecord = existingMeeting;
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

    return NextResponse.json(
      {
        success: true,
        meeting: meetingRecord,
        recording: recordingRecord,
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
