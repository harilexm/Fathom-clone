import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
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
 * GET /api/meetings/[id]/share
 * Get sharing status and all share links for a meeting
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
      .select("id, user_id, title")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetErr || !meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (meeting.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: shareLinks, error: shareErr } = await supabase
      .from("share_links")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false });

    if (shareErr) {
      return NextResponse.json({ error: shareErr.message }, { status: 500 });
    }

    const links = (shareLinks || []).map((link) => {
      let highlightId = (link as { highlight_id?: string }).highlight_id || null;
      if (!highlightId && link.token.startsWith("hl_")) {
        const parts = link.token.split("_");
        if (parts.length >= 3) highlightId = parts[1];
      }
      return {
        id: link.id,
        token: link.token,
        status: link.status,
        isActive: link.is_active !== false && link.status === "active",
        highlightId,
        createdAt: link.created_at,
        revokedAt: link.revoked_at,
      };
    });

    const activeMeetingLink = links.find((l) => l.isActive && !l.highlightId) || null;

    return NextResponse.json({
      success: true,
      activeMeetingLink,
      shareLinks: links,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/meetings/[id]/share
 * Create, reactivate, or update share link for a meeting or highlight.
 * Supports:
 * - access: "anyone" (activates/creates link)
 * - access: "only_me" (revokes link)
 * - optional highlightId for sharing a specific highlight
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
      .select("id, user_id, title")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetErr || !meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (meeting.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const access = body.access === "only_me" ? "only_me" : "anyone";
    const highlightId = typeof body.highlightId === "string" && UUID_REGEX.test(body.highlightId)
      ? body.highlightId
      : null;

    if (highlightId) {
      // Verify highlight exists and belongs to this meeting
      const { data: hl, error: hlErr } = await supabase
        .from("highlights")
        .select("id")
        .eq("id", highlightId)
        .eq("meeting_id", meetingId)
        .maybeSingle();

      if (hlErr || !hl) {
        return NextResponse.json({ error: "Highlight not found for this meeting" }, { status: 404 });
      }
    }

    // 1. If access is "only_me", revoke active share links for this target
    if (access === "only_me") {
      const { data: existingLinks, error: listErr } = await supabase
        .from("share_links")
        .select("id, token, status, is_active")
        .eq("meeting_id", meetingId);

      if (listErr) {
        return NextResponse.json({ error: listErr.message }, { status: 500 });
      }

      const matchingLinks = (existingLinks || []).filter((l) => {
        if (highlightId) {
          return l.token.startsWith(`hl_${highlightId}_`);
        } else {
          return !l.token.startsWith("hl_");
        }
      });

      const now = new Date().toISOString();
      for (const link of matchingLinks) {
        await supabase
          .from("share_links")
          .update({
            status: "revoked",
            state: "revoked",
            is_active: false,
            revoked_at: now,
            updated_at: now,
          })
          .eq("id", link.id);
      }

      return NextResponse.json({
        success: true,
        access: "only_me",
        message: "Share access set to Only me (link revoked)",
      });
    }

    // 2. access is "anyone" -> ensure an active share link exists
    // Check if an active link already exists for this target
    const { data: existingLinks } = await supabase
      .from("share_links")
      .select("id, token, status, is_active")
      .eq("meeting_id", meetingId);

    const activeExisting = (existingLinks || []).find((l) => {
      const isActive = l.status === "active" && l.is_active !== false;
      if (!isActive) return false;
      if (highlightId) {
        return l.token.startsWith(`hl_${highlightId}_`);
      } else {
        return !l.token.startsWith("hl_");
      }
    });

    if (activeExisting) {
      return NextResponse.json({
        success: true,
        access: "anyone",
        token: activeExisting.token,
        shareLink: {
          id: activeExisting.id,
          token: activeExisting.token,
          status: "active",
          isActive: true,
          highlightId,
        },
      });
    }

    // Generate unique cryptographically secure token
    const randomHex = crypto.randomBytes(16).toString("hex");
    const token = highlightId ? `hl_${highlightId}_${randomHex}` : `m_${randomHex}`;

    // Try inserting into share_links (with highlight_id if column exists, fallback without)
    const insertRow: Record<string, unknown> = {
      meeting_id: meetingId,
      token,
      status: "active",
      state: "active",
      is_active: true,
      revoked_at: null,
    };
    if (highlightId) {
      insertRow.highlight_id = highlightId;
    }

    let inserted = null;
    const firstInsert = await supabase
      .from("share_links")
      .insert(insertRow)
      .select()
      .single();

    if (firstInsert.error) {
      // If highlight_id column doesn't exist yet on remote db (PGRST204), remove it and re-try
      if (firstInsert.error.code === "PGRST204" || firstInsert.error.message?.includes("column \"highlight_id\"")) {
        delete insertRow.highlight_id;
        const retryInsert = await supabase
          .from("share_links")
          .insert(insertRow)
          .select()
          .single();

        if (retryInsert.error) {
          return NextResponse.json(
            { error: `Failed to create share link: ${retryInsert.error.message}` },
            { status: 500 }
          );
        }
        inserted = retryInsert.data;
      } else {
        return NextResponse.json(
          { error: `Failed to create share link: ${firstInsert.error.message}` },
          { status: 500 }
        );
      }
    } else {
      inserted = firstInsert.data;
    }

    return NextResponse.json(
      {
        success: true,
        access: "anyone",
        token: inserted.token,
        shareLink: {
          id: inserted.id,
          token: inserted.token,
          status: "active",
          isActive: true,
          highlightId,
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
 * DELETE /api/meetings/[id]/share
 * Revoke or delete a specific share link by token or id
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

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const linkId = searchParams.get("linkId") || searchParams.get("id");

    if (!token && !linkId) {
      return NextResponse.json({ error: "Token or linkId is required" }, { status: 400 });
    }

    let query = supabase.from("share_links").update({
      status: "revoked",
      state: "revoked",
      is_active: false,
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("meeting_id", meetingId);

    if (linkId) {
      query = query.eq("id", linkId);
    } else if (token) {
      query = query.eq("token", token);
    }

    const { error: revokeErr } = await query;
    if (revokeErr) {
      return NextResponse.json({ error: revokeErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Share link revoked successfully" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
