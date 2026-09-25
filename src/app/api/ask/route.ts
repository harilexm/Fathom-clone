import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { askFathom, type AskMessage, type AskScope } from "@/lib/ask-fathom";

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

/**
 * POST /api/ask
 *
 * Handles Ask Fathom questions for two scopes:
 * - "my-calls": Searches authenticated user's processed calls, retrieves only relevant context.
 * - "meeting": Strictly uses only that meeting's transcript, summary, actions, decisions, highlights.
 *
 * Uses OpenAI primary, falls back to Anthropic only if OpenAI fails.
 * Streams responses as Server-Sent Events (SSE).
 * Uses 0 credits.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required" },
        { status: 401 }
      );
    }

    let body: {
      scope?: AskScope;
      meetingId?: string;
      question?: string;
      history?: AskMessage[];
      stream?: boolean;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const { scope, meetingId, question, history, stream = true } = body;

    if (!scope || (scope !== "my-calls" && scope !== "meeting")) {
      return NextResponse.json(
        { error: "Invalid scope. Must be 'my-calls' or 'meeting'" },
        { status: 400 }
      );
    }

    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: "Question cannot be empty" },
        { status: 400 }
      );
    }

    if (scope === "meeting" && (!meetingId || !meetingId.trim())) {
      return NextResponse.json(
        { error: "meetingId is required when scope is 'meeting'" },
        { status: 400 }
      );
    }

    const simulateOpenAiFailure = request.headers.get("x-test-simulate-openai-failure") === "true";

    // If client requested non-streaming mode
    if (stream === false) {
      const result = await askFathom({
        scope,
        meetingId: meetingId?.trim(),
        question: question.trim(),
        history: Array.isArray(history) ? history : [],
        user: { id: user.id, email: user.email },
        supabase,
        simulateOpenAiFailure,
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    // Default: Stream via Server-Sent Events (SSE)
    const encoder = new TextEncoder();
    const transformStream = new TransformStream();
    const writer = transformStream.writable.getWriter();

    (async () => {
      try {
        const result = await askFathom({
          scope,
          meetingId: meetingId?.trim(),
          question: question.trim(),
          history: Array.isArray(history) ? history : [],
          user: { id: user.id, email: user.email },
          supabase,
          simulateOpenAiFailure,
          onChunk: (chunkText) => {
            const chunkEvent = `event: chunk\ndata: ${JSON.stringify({ text: chunkText })}\n\n`;
            writer.write(encoder.encode(chunkEvent)).catch(() => {});
          },
        });

        // Emit final metadata and done event
        const metadataEvent = `event: metadata\ndata: ${JSON.stringify({
          scope: result.scope,
          meetingId: result.meetingId,
          meetingTitle: result.meetingTitle,
          sources: result.sources,
          provider: result.provider,
          relevantMeetingCount: result.relevantMeetingCount,
        })}\n\n`;
        await writer.write(encoder.encode(metadataEvent));

        const doneEvent = `event: done\ndata: ${JSON.stringify({
          fullText: result.answer,
          provider: result.provider,
        })}\n\n`;
        await writer.write(encoder.encode(doneEvent));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "LLM query failed";
        const errEvent = `event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`;
        await writer.write(encoder.encode(errEvent)).catch(() => {});
      } finally {
        await writer.close().catch(() => {});
      }
    })();

    return new Response(transformStream.readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status =
      message.includes("Forbidden") ? 403 :
      message.includes("not found") ? 404 :
      message.includes("required") || message.includes("Invalid") ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * GET /api/ask
 *
 * Returns available scopes for the authenticated user (My Calls + processed meetings).
 */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required" },
        { status: 401 }
      );
    }

    const { data: dbMeetings, error } = await supabase
      .from("meetings")
      .select("id, title, status, meeting_time, created_at")
      .eq("user_id", user.id)
      .in("status", ["completed", "ready"])
      .order("meeting_time", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const processedMeetings = (dbMeetings || []).map((m) => ({
      id: m.id,
      title: m.title || "Untitled Meeting",
      status: m.status,
      date: m.meeting_time || m.created_at,
    }));

    return NextResponse.json({
      scopes: [
        { id: "my-calls", label: "My Calls", type: "library" },
        ...processedMeetings.map((m) => ({
          id: m.id,
          label: m.title,
          type: "meeting",
          status: m.status,
          date: m.date,
        })),
      ],
      processedMeetings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
