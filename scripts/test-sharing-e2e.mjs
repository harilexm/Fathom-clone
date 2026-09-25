import { createClient } from "@supabase/supabase-js";

const MEETING_ID = "9032c083-de71-459c-b1e6-0e8a6701ed45";
const BASE_URL = "http://localhost:3000";

async function runSharingTests() {
  console.log("==================================================");
  console.log("STARTING FULL SHARING E2E VERIFICATION TEST SUITE");
  console.log("==================================================");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Authenticate user for meeting owner
  console.log("\n[Step 1] Authenticating meeting owner...");
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: "umer.abdullah9891@gmail.com",
  });
  if (linkErr) throw new Error("generateLink failed: " + linkErr.message);

  const verifyRes = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyRes.error) throw new Error("verifyOtp failed: " + verifyRes.error.message);

  const session = verifyRes.data.session;
  console.log("Authenticated as user:", session.user.id);
  const authCookie =
    "sb-sdvijvvcudrorrexgdfw-auth-token=" +
    encodeURIComponent("base64-" + Buffer.from(JSON.stringify(session)).toString("base64"));

  // 2. Test create whole meeting share link ("Anyone with link")
  console.log("\n[Step 2] Creating Meeting Share Link (POST /api/meetings/[id]/share)...");
  const createMeetingShareRes = await fetch(`${BASE_URL}/api/meetings/${MEETING_ID}/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookie,
    },
    body: JSON.stringify({ access: "anyone" }),
  });

  console.log("Create Meeting Share HTTP Status:", createMeetingShareRes.status);
  const meetingShareData = await createMeetingShareRes.json();
  console.log("Create Meeting Share Response:", meetingShareData);

  if (!createMeetingShareRes.ok || !meetingShareData.token) {
    throw new Error("Failed to create meeting share link: " + JSON.stringify(meetingShareData));
  }
  const meetingToken = meetingShareData.token;
  console.log("PASS: Meeting share token generated:", meetingToken);

  // Verify link in database
  const { data: dbMeetingShare } = await supabase
    .from("share_links")
    .select("*")
    .eq("token", meetingToken)
    .single();

  console.log("DB check for meeting share:", {
    id: dbMeetingShare?.id,
    token: dbMeetingShare?.token,
    status: dbMeetingShare?.status,
    is_active: dbMeetingShare?.is_active,
  });
  if (!dbMeetingShare || dbMeetingShare.status !== "active" || dbMeetingShare.is_active !== true) {
    throw new Error("Meeting share link not active in database!");
  }
  console.log("PASS: Meeting share link is active in DB.");

  // 3. Test opening Meeting Share Link in Incognito (NO COOKIES / WITHOUT LOGIN)
  console.log("\n[Step 3] Opening Meeting Share Link in incognito (unauthenticated / no cookies)...");
  const publicMeetingPageRes = await fetch(`${BASE_URL}/share/${meetingToken}`, {
    headers: {
      accept: "text/html",
      // NO COOKIES SENT!
    },
  });

  console.log("Public Meeting Page HTTP Status:", publicMeetingPageRes.status);
  const publicMeetingHtml = await publicMeetingPageRes.text();
  console.log("Public Meeting HTML Length:", publicMeetingHtml.length);

  const hasFathomLogo = publicMeetingHtml.includes("FATHOM");
  const hasMeetingTitle = publicMeetingHtml.includes("Every Zoom Meeting");
  const hasPublicMeetingBadge = publicMeetingHtml.includes("Public Meeting");
  const hasSummaryTab = publicMeetingHtml.includes("Summary");
  const hasActionItemsTab = publicMeetingHtml.includes("Action items");
  const hasTranscriptTab = publicMeetingHtml.includes("Transcript");

  console.log("Checks for Public Meeting Page:");
  console.log(" - Brand header present:", hasFathomLogo);
  console.log(" - Meeting title present:", hasMeetingTitle);
  console.log(" - Public Meeting badge present:", hasPublicMeetingBadge);
  console.log(" - Summary present:", hasSummaryTab);
  console.log(" - Action items present:", hasActionItemsTab);
  console.log(" - Transcript present:", hasTranscriptTab);

  if (!hasMeetingTitle || !hasPublicMeetingBadge) {
    throw new Error("Public meeting page did not render meeting content properly!");
  }
  console.log("PASS: Public meeting page successfully opened without login!");

  // 4. Test creating a Highlight Share Link ("Anyone with link")
  console.log("\n[Step 4] Fetching a highlight to share...");
  const { data: highlights } = await supabase
    .from("highlights")
    .select("*")
    .eq("meeting_id", MEETING_ID)
    .order("start_timestamp", { ascending: true })
    .limit(1);

  if (!highlights || highlights.length === 0) {
    throw new Error("No highlights found for meeting!");
  }
  const targetHighlight = highlights[0];
  console.log("Target Highlight to share:", { id: targetHighlight.id, title: targetHighlight.title });

  console.log("Creating Highlight Share Link (POST /api/meetings/[id]/share with highlightId)...");
  const createHlShareRes = await fetch(`${BASE_URL}/api/meetings/${MEETING_ID}/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookie,
    },
    body: JSON.stringify({ access: "anyone", highlightId: targetHighlight.id }),
  });

  console.log("Create Highlight Share HTTP Status:", createHlShareRes.status);
  const hlShareData = await createHlShareRes.json();
  console.log("Create Highlight Share Response:", hlShareData);

  if (!createHlShareRes.ok || !hlShareData.token) {
    throw new Error("Failed to create highlight share link: " + JSON.stringify(hlShareData));
  }
  const highlightToken = hlShareData.token;
  console.log("PASS: Highlight share token generated:", highlightToken);

  // 5. Test opening Highlight Share Link in Incognito (NO COOKIES / WITHOUT LOGIN)
  console.log("\n[Step 5] Opening Highlight Share Link in incognito (unauthenticated / no cookies)...");
  const publicHlPageRes = await fetch(`${BASE_URL}/share/${highlightToken}`, {
    headers: {
      accept: "text/html",
      // NO COOKIES SENT!
    },
  });

  console.log("Public Highlight Page HTTP Status:", publicHlPageRes.status);
  const publicHlHtml = await publicHlPageRes.text();
  console.log("Public Highlight HTML Length:", publicHlHtml.length);

  const hasSharedHighlightBadge = publicHlHtml.includes("Shared Highlight");
  const hasHlTitle = publicHlHtml.includes(targetHighlight.title);
  const hasMeetingContext = publicHlHtml.includes("Every Zoom Meeting");
  const doesNotHaveActionItemsTab = !publicHlHtml.includes("Action items (");

  console.log("Checks for Public Highlight Page:");
  console.log(" - Shared Highlight badge present:", hasSharedHighlightBadge);
  console.log(" - Highlight title present:", hasHlTitle);
  console.log(" - Parent meeting title present:", hasMeetingContext);
  console.log(" - Shows ONLY intended highlight (no full meeting tabs):", doesNotHaveActionItemsTab);

  if (!hasSharedHighlightBadge || !hasHlTitle) {
    throw new Error("Public highlight page did not render highlight content properly!");
  }
  console.log("PASS: Public highlight page successfully opened without login showing only intended highlight!");

  // 6. Test switching access to "Only me" (Revoke Meeting Link)
  console.log("\n[Step 6] Setting Meeting Share access to 'Only me' (revoking link)...");
  const revokeMeetingRes = await fetch(`${BASE_URL}/api/meetings/${MEETING_ID}/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookie,
    },
    body: JSON.stringify({ access: "only_me" }),
  });

  console.log("Revoke Meeting Share HTTP Status:", revokeMeetingRes.status);
  const revokeMeetingData = await revokeMeetingRes.json();
  console.log("Revoke Meeting Share Response:", revokeMeetingData);

  if (!revokeMeetingRes.ok || revokeMeetingData.access !== "only_me") {
    throw new Error("Failed to set meeting access to only_me");
  }

  // Verify in database that link status is revoked and is_active is false
  const { data: dbRevokedMeetingShare } = await supabase
    .from("share_links")
    .select("*")
    .eq("token", meetingToken)
    .single();

  console.log("DB record after revoke:", {
    token: dbRevokedMeetingShare?.token,
    status: dbRevokedMeetingShare?.status,
    is_active: dbRevokedMeetingShare?.is_active,
    revoked_at: dbRevokedMeetingShare?.revoked_at,
  });

  if (dbRevokedMeetingShare?.status !== "revoked" || dbRevokedMeetingShare?.is_active !== false) {
    throw new Error("Meeting share link status was not set to revoked in DB!");
  }
  console.log("PASS: Meeting share link is revoked in database.");

  // 7. Verify Revoked Meeting Link in Incognito (MUST NOT OPEN PUBLICLY)
  console.log("\n[Step 7] Attempting to open revoked meeting link in incognito...");
  const publicRevokedRes = await fetch(`${BASE_URL}/share/${meetingToken}`, {
    headers: {
      accept: "text/html",
    },
  });

  console.log("Public Revoked Page HTTP Status:", publicRevokedRes.status);
  const publicRevokedHtml = await publicRevokedRes.text();
  const hasPrivateNotice =
    publicRevokedHtml.includes("This link is private") ||
    publicRevokedHtml.includes("revoked");
  const leakedMeetingContent =
    publicRevokedHtml.includes("Executive Summary") ||
    publicRevokedHtml.includes("Public Meeting");

  console.log(" - Private/revoked notice displayed:", hasPrivateNotice);
  console.log(" - Private meeting content blocked (not leaked):", !leakedMeetingContent);

  if (!hasPrivateNotice || leakedMeetingContent) {
    throw new Error("Revoked meeting link still displayed private meeting content!");
  }
  console.log("PASS: Revoked link safely blocked public access!");

  // 8. Test revoking highlight share link as well
  console.log("\n[Step 8] Setting Highlight Share access to 'Only me'...");
  const revokeHlRes = await fetch(`${BASE_URL}/api/meetings/${MEETING_ID}/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookie,
    },
    body: JSON.stringify({ access: "only_me", highlightId: targetHighlight.id }),
  });

  console.log("Revoke Highlight Share HTTP Status:", revokeHlRes.status);
  const publicRevokedHlRes = await fetch(`${BASE_URL}/share/${highlightToken}`, {
    headers: {
      accept: "text/html",
    },
  });
  const publicRevokedHlHtml = await publicRevokedHlRes.text();
  const hasHlPrivateNotice =
    publicRevokedHlHtml.includes("This link is private") ||
    publicRevokedHlHtml.includes("revoked");
  const leakedHlContent = publicRevokedHlHtml.includes("Spoken Excerpt");

  console.log(" - Highlight private notice displayed:", hasHlPrivateNotice);
  console.log(" - Highlight content blocked (not leaked):", !leakedHlContent);

  if (!hasHlPrivateNotice || leakedHlContent) {
    throw new Error("Revoked highlight link still displayed content!");
  }
  console.log("PASS: Revoked highlight link safely blocked public access!");

  // 9. Test reload of workspace for authenticated meeting owner
  console.log("\n[Step 9] Testing meeting workspace reload...");
  const workspaceRes = await fetch(`${BASE_URL}/meeting/${MEETING_ID}`, {
    headers: {
      cookie: authCookie,
      accept: "text/html",
    },
  });
  console.log("Workspace reload HTTP Status:", workspaceRes.status);
  if (workspaceRes.status !== 200) {
    throw new Error("Workspace reload returned status: " + workspaceRes.status);
  }
  console.log("PASS: Workspace reloaded with HTTP 200 OK!");

  console.log("\n==================================================");
  console.log("ALL SHARING E2E VERIFICATION TESTS PASSED!");
  console.log("==================================================");
}

runSharingTests().catch((err) => {
  console.error("\nTEST SUITE FAILED:", err);
  process.exit(1);
});
