import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMeetingDate, formatTimestamp, formatMeetingDuration } from "@/lib/meetings";

export interface SearchResultItem {
  id: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  duration?: string;
  matchType: "title" | "participant" | "transcript" | "summary" | "action_item";
  snippet: string;
  speaker?: string;
  timestamp?: string;
  timestampSec?: number;
  targetUrl: string;
}

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

function extractSnippet(text: string, query: string, maxLength = 140): string {
  if (!text) return "";
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1 || text.length <= maxLength) {
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
  }

  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 80);

  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    if (!query) {
      return NextResponse.json({
        query: "",
        results: [],
        totalCount: 0,
      });
    }

    const lowerQuery = query.toLowerCase();

    // 1. Fetch user meetings for title and participant matching
    const { data: allMeetings, error: meetErr } = await supabase
      .from("meetings")
      .select("id, title, meeting_time, duration, duration_seconds, created_at, participants")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (meetErr) {
      return NextResponse.json({ error: meetErr.message }, { status: 500 });
    }

    const results: SearchResultItem[] = [];

    // Title & Participant matches
    for (const m of allMeetings || []) {
      const titleMatches = m.title?.toLowerCase().includes(lowerQuery);
      const dateStr = formatMeetingDate(m.meeting_time || m.created_at);
      const durStr = formatMeetingDuration(m.duration || m.duration_seconds || 0);

      if (titleMatches) {
        results.push({
          id: `title-${m.id}`,
          meetingId: m.id,
          meetingTitle: m.title,
          meetingDate: dateStr,
          duration: durStr,
          matchType: "title",
          snippet: m.title,
          targetUrl: `/meeting/${m.id}`,
        });
      }

      if (Array.isArray(m.participants)) {
        for (const p of m.participants) {
          const participantName = String(p);
          if (participantName.toLowerCase().includes(lowerQuery)) {
            results.push({
              id: `part-${m.id}-${participantName}`,
              meetingId: m.id,
              meetingTitle: m.title,
              meetingDate: dateStr,
              duration: durStr,
              matchType: "participant",
              snippet: `Participant: ${participantName}`,
              speaker: participantName,
              targetUrl: `/meeting/${m.id}`,
            });
          }
        }
      }
    }

    // 2. Transcript segments match
    const { data: transcriptMatches } = await supabase
      .from("transcript_segments")
      .select("id, meeting_id, text, speaker, start_time, sequence, meetings!inner(id, title, user_id, meeting_time, duration, duration_seconds, created_at)")
      .eq("meetings.user_id", user.id)
      .or(`text.ilike.%${query}%,speaker.ilike.%${query}%`)
      .order("start_time", { ascending: true })
      .limit(40);

    for (const tr of transcriptMatches || []) {
      const meet = tr.meetings as unknown as {
        id: string;
        title: string;
        meeting_time?: string;
        duration?: number;
        duration_seconds?: number;
        created_at: string;
      };
      const dateStr = formatMeetingDate(meet.meeting_time || meet.created_at);
      const durStr = formatMeetingDuration(meet.duration || meet.duration_seconds || 0);
      const timeSec = Number(tr.start_time) || 0;

      results.push({
        id: `tr-${tr.id}`,
        meetingId: meet.id,
        meetingTitle: meet.title,
        meetingDate: dateStr,
        duration: durStr,
        matchType: "transcript",
        snippet: extractSnippet(tr.text, query),
        speaker: tr.speaker,
        timestamp: formatTimestamp(timeSec),
        timestampSec: timeSec,
        targetUrl: `/meeting/${meet.id}?t=${timeSec}&tab=transcript`,
      });
    }

    // 3. Action items match
    const { data: actionMatches } = await supabase
      .from("action_items")
      .select("id, meeting_id, task, owner, due_date, completed, meetings!inner(id, title, user_id, meeting_time, duration, duration_seconds, created_at)")
      .eq("meetings.user_id", user.id)
      .or(`task.ilike.%${query}%,owner.ilike.%${query}%`)
      .limit(20);

    for (const act of actionMatches || []) {
      const meet = act.meetings as unknown as {
        id: string;
        title: string;
        meeting_time?: string;
        duration?: number;
        duration_seconds?: number;
        created_at: string;
      };
      const dateStr = formatMeetingDate(meet.meeting_time || meet.created_at);
      const durStr = formatMeetingDuration(meet.duration || meet.duration_seconds || 0);

      results.push({
        id: `act-${act.id}`,
        meetingId: meet.id,
        meetingTitle: meet.title,
        meetingDate: dateStr,
        duration: durStr,
        matchType: "action_item",
        snippet: extractSnippet(act.task, query),
        speaker: act.owner ? `Owner: ${act.owner}` : undefined,
        targetUrl: `/meeting/${meet.id}?tab=actions`,
      });
    }

    // 4. Summary & overview match
    const { data: summaryMatches, error: sumErr } = await supabase
      .from("summary_versions")
      .select("id, meeting_id, version, summary, content, overview, meetings!inner(id, title, user_id, meeting_time, duration, duration_seconds, created_at)")
      .eq("meetings.user_id", user.id)
      .or(`summary.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(20);

    if (sumErr) {
      console.error("Summary search query error:", sumErr);
    }

    const matchedSummaryMeetingIds = new Set<string>();

    for (const sum of summaryMatches || []) {
      if (matchedSummaryMeetingIds.has(sum.meeting_id)) continue;
      matchedSummaryMeetingIds.add(sum.meeting_id);

      const meet = sum.meetings as unknown as {
        id: string;
        title: string;
        meeting_time?: string;
        duration?: number;
        duration_seconds?: number;
        created_at: string;
      };
      const dateStr = formatMeetingDate(meet.meeting_time || meet.created_at);
      const durStr = formatMeetingDuration(meet.duration || meet.duration_seconds || 0);

      let summarySnippet = "";
      if (sum.summary && sum.summary.toLowerCase().includes(lowerQuery)) {
        summarySnippet = extractSnippet(sum.summary, query);
      } else if (sum.content && sum.content.toLowerCase().includes(lowerQuery)) {
        summarySnippet = extractSnippet(sum.content, query);
      } else if (Array.isArray(sum.overview)) {
        const matchingBullet = sum.overview.find((b) =>
          String(b).toLowerCase().includes(lowerQuery)
        );
        if (matchingBullet) {
          summarySnippet = extractSnippet(String(matchingBullet), query);
        }
      }

      if (!summarySnippet && sum.summary) {
        summarySnippet = extractSnippet(sum.summary, query);
      }

      results.push({
        id: `sum-${sum.id}`,
        meetingId: meet.id,
        meetingTitle: meet.title,
        meetingDate: dateStr,
        duration: durStr,
        matchType: "summary",
        snippet: summarySnippet,
        targetUrl: `/meeting/${meet.id}?tab=summary`,
      });
    }

    // Also check overview bullets for meetings whose summary/content did not directly match
    if (allMeetings && allMeetings.length > 0) {
      const unmatchedMeetingIds = allMeetings
        .map((m) => m.id)
        .filter((id) => !matchedSummaryMeetingIds.has(id));

      if (unmatchedMeetingIds.length > 0) {
        const { data: otherSummaries } = await supabase
          .from("summary_versions")
          .select("id, meeting_id, version, summary, overview, meetings!inner(id, title, user_id, meeting_time, duration, duration_seconds, created_at)")
          .in("meeting_id", unmatchedMeetingIds)
          .limit(20);

        for (const sum of otherSummaries || []) {
          if (matchedSummaryMeetingIds.has(sum.meeting_id)) continue;

          if (Array.isArray(sum.overview)) {
            const matchingBullet = sum.overview.find((b) =>
              String(b).toLowerCase().includes(lowerQuery)
            );
            if (matchingBullet) {
              matchedSummaryMeetingIds.add(sum.meeting_id);
              const meet = sum.meetings as unknown as {
                id: string;
                title: string;
                meeting_time?: string;
                duration?: number;
                duration_seconds?: number;
                created_at: string;
              };
              const dateStr = formatMeetingDate(meet.meeting_time || meet.created_at);
              const durStr = formatMeetingDuration(meet.duration || meet.duration_seconds || 0);

              results.push({
                id: `sum-ov-${sum.id}`,
                meetingId: meet.id,
                meetingTitle: meet.title,
                meetingDate: dateStr,
                duration: durStr,
                matchType: "summary",
                snippet: extractSnippet(String(matchingBullet), query),
                targetUrl: `/meeting/${meet.id}?tab=summary`,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      query,
      results,
      totalCount: results.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
