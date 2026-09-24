import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPresignedUploadUrl } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

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
    // Session cookies lookup failed, check Authorization header below
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

interface RequestParams {
  meetingId?: string;
  filename?: string;
  contentType?: string;
}

async function extractParams(request: NextRequest): Promise<RequestParams> {
  let body: Record<string, unknown> = {};

  if (request.method === "POST") {
    try {
      const text = await request.text();
      if (text && text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      body = {};
    }
  }

  const searchParams = request.nextUrl.searchParams;

  const meetingId =
    (typeof body.meetingId === "string" ? body.meetingId : null) ||
    (typeof body.meeting_id === "string" ? body.meeting_id : null) ||
    searchParams.get("meetingId") ||
    searchParams.get("meeting_id") ||
    undefined;

  const filename =
    (typeof body.filename === "string" ? body.filename : null) ||
    (typeof body.fileName === "string" ? body.fileName : null) ||
    searchParams.get("filename") ||
    searchParams.get("fileName") ||
    undefined;

  const contentType =
    (typeof body.contentType === "string" ? body.contentType : null) ||
    (typeof body.content_type === "string" ? body.content_type : null) ||
    (typeof body.mimeType === "string" ? body.mimeType : null) ||
    searchParams.get("contentType") ||
    searchParams.get("content_type") ||
    searchParams.get("mimeType") ||
    undefined;

  return { meetingId, filename, contentType };
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

    const { meetingId, filename, contentType } = await extractParams(request);

    let targetMeetingId: string;

    if (meetingId) {
      if (!UUID_REGEX.test(meetingId)) {
        return NextResponse.json(
          { error: "Invalid meetingId format. Must be a valid UUID." },
          { status: 400 },
        );
      }

      // Validate that meeting exists and belongs to the authenticated user
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select("id, user_id")
        .eq("id", meetingId)
        .maybeSingle();

      if (meetingError || !meeting) {
        return NextResponse.json(
          { error: "Meeting not found or access denied" },
          { status: 404 },
        );
      }

      if (meeting.user_id !== user.id) {
        return NextResponse.json(
          { error: "Forbidden: Access denied to this meeting" },
          { status: 403 },
        );
      }

      targetMeetingId = meeting.id;
    } else {
      // Do not create a meeting record in database yet.
      // Meeting and recording records are created only after a successful R2 upload.
      targetMeetingId = crypto.randomUUID();
    }

    // Generate short-lived presigned upload URL (15 minutes expiry)
    const { uploadUrl, objectKey } = await createPresignedUploadUrl({
      userId: user.id,
      meetingId: targetMeetingId,
      filename,
      contentType,
      expiresIn: 900,
    });

    // Return only the signed upload URL and object key
    return NextResponse.json({
      uploadUrl,
      objectKey,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  // Support GET with query params as well
  return POST(request);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
    },
  });
}
