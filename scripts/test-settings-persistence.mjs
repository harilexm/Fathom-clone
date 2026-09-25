import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishableKey || !secretKey) throw new Error("Supabase test configuration is missing");

const browserCookies = new Map();
const guest = createServerClient(url, publishableKey, {
  cookies: {
    getAll: () => [...browserCookies].map(([name, value]) => ({ name, value })),
    setAll: (items) => items.forEach(({ name, value }) => browserCookies.set(name, value)),
  },
});
const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
let testUserId;
try {
  const { data: login, error: loginError } = await guest.auth.signInAnonymously();
  if (loginError || !login.user) throw new Error("Demo sign-in failed");
  testUserId = login.user.id;

  const { error: bootstrapError } = await guest.rpc("ensure_profile");
  if (bootstrapError) throw new Error("Profile bootstrap failed");

  const { error: profileSaveError } = await admin.from("profiles")
    .update({
      meeting_preference: "manual", sharing_preference: "private",
      usage_type: "individual", calendar_status: "skipped",
      onboarding_step: 5, onboarding_completed: true,
    }).eq("id", testUserId);
  if (profileSaveError) throw new Error("Profile preference save failed");

  const { error: metadataSaveError } = await admin.auth.admin.updateUserById(testUserId, {
    user_metadata: { ...login.user.user_metadata, summary_template: "concise", highlight_preference: "none" },
  });
  if (metadataSaveError) throw new Error("Auth preference save failed");

  const { data: profile, error: profileReadError } = await guest.from("profiles")
    .select("meeting_preference, sharing_preference, trial_ends_at").eq("id", testUserId).single();
  if (profileReadError || profile.meeting_preference !== "manual" || profile.sharing_preference !== "private") {
    throw new Error("Profile preferences did not persist");
  }
  const { data: refreshed, error: metadataReadError } = await guest.auth.getUser();
  if (metadataReadError || refreshed.user?.user_metadata?.summary_template !== "concise" ||
    refreshed.user?.user_metadata?.highlight_preference !== "none") {
    throw new Error("Auth preferences did not persist");
  }
  const trialDays = (Date.parse(profile.trial_ends_at) - Date.parse(login.user.created_at)) / 86400000;
  if (Math.abs(trialDays - 14) > 0.01) throw new Error("Demo trial is not 14 days");
  console.log("PASS: Demo profile and Auth preferences persist; trial lasts 14 days.");

  const origin = process.env.SETTINGS_TEST_ORIGIN ?? "http://127.0.0.1:3001";
  const cookieHeader = [...browserCookies].map(([name, value]) => `${name}=${value}`).join("; ");
  let settingsHtml = "";
  for (const [path, expectedText] of [
    ["/settings", "Default summary template"],
    ["/pricing", "14-day Pro trial"],
    ["/faqs", "How can I sign in?"],
    ["/privacy-policy", "Information stored"],
    ["/terms-of-service", "Trial, credits, and billing"],
    ["/security-compliance", "Account and data access"],
  ]) {
    const response = await fetch(new URL(path, origin), { headers: { cookie: cookieHeader }, redirect: "manual" });
    const html = await response.text();
    if (response.status !== 200 || !html.includes(expectedText)) {
      throw new Error(`${path} did not render for a signed-in Demo account (${response.status})`);
    }
    if (path === "/settings") {
      settingsHtml = html;
      for (const href of ["/pricing", "/faqs", "/privacy-policy", "/terms-of-service", "/security-compliance"]) {
        if (!html.includes(`href="${href}"`)) throw new Error(`Account link ${href} is missing`);
      }
    }
  }
  console.log("PASS: Settings, Pricing, FAQs, Privacy, Terms, and Security render; account links resolve.");

  async function submitPreference(key, value, expectedOutcome = "saved") {
    const formHtml = [...settingsHtml.matchAll(/<form[^>]*>[\s\S]*?<\/form>/g)]
      .map(([html]) => html).find((html) => html.includes(`name="key" value="${key}"`));
    const actionField = formHtml?.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
    if (!actionField) throw new Error(`${key} form action was not rendered`);
    const form = new FormData();
    form.set(actionField, "");
    form.set("key", key);
    form.set("value", value);
    const response = await fetch(new URL("/settings", origin), {
      method: "POST", headers: { cookie: cookieHeader, origin }, body: form, redirect: "manual",
    });
    const text = await response.text();
    if (!(response.headers.get("location")?.includes(`preference=${expectedOutcome}`) ||
      text.includes(expectedOutcome === "saved" ? "Preference saved." : "That preference is unavailable."))) {
      throw new Error(`${key} returned an unexpected save outcome (${response.status})`);
    }
  }

  await submitPreference("summary_template", "standard");
  await submitPreference("highlight_preference", "suggest");
  await submitPreference("meeting_preference", "manual");
  await submitPreference("sharing_preference", "private");
  await submitPreference("sharing_preference", "team", "invalid");

  const { data: afterSave, error: afterSaveError } = await admin.auth.admin.getUserById(testUserId);
  const { data: afterProfile, error: afterProfileError } = await guest.from("profiles")
    .select("meeting_preference, sharing_preference").eq("id", testUserId).single();
  if (afterSaveError || afterProfileError || afterSave.user?.user_metadata?.summary_template !== "standard" ||
    afterSave.user?.user_metadata?.highlight_preference !== "suggest" ||
    afterProfile.meeting_preference !== "manual" || afterProfile.sharing_preference !== "private") {
    throw new Error("Settings form changes did not persist or invalid value changed a preference");
  }
  console.log("PASS: All four Settings forms persisted; invalid team-sharing value was rejected.");

  const { error: connectError } = await admin.rpc("record_calendar_outcome", {
    p_user_id: testUserId, p_status: "connected", p_refresh_token_ciphertext: "disposable-test-value",
    p_scope: "https://www.googleapis.com/auth/calendar.readonly", p_account_email: "test@example.invalid",
  });
  if (connectError) throw new Error("Could not prepare disposable Calendar connection");
  const connectedPage = await fetch(new URL("/settings", origin), { headers: { cookie: cookieHeader } });
  const connectedHtml = await connectedPage.text();
  if (!connectedHtml.includes("Reconnect") || !connectedHtml.includes("Disconnect") ||
    !connectedHtml.includes('href="/onboarding/calendar/start?returnTo=settings"')) {
    throw new Error("Connected Calendar controls did not render");
  }
  const disconnectForm = [...connectedHtml.matchAll(/<form[^>]*>[\s\S]*?<\/form>/g)]
    .map(([html]) => html).find((html) => html.includes("Disconnect</button>"));
  const disconnectAction = disconnectForm?.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
  if (!disconnectAction) throw new Error("Calendar disconnect action is missing");
  const disconnectData = new FormData();
  disconnectData.set(disconnectAction, "");
  const disconnectResponse = await fetch(new URL("/settings", origin), {
    method: "POST", headers: { cookie: cookieHeader, origin }, body: disconnectData, redirect: "manual",
  });
  const disconnectBody = await disconnectResponse.text();
  if (!(disconnectResponse.headers.get("location")?.includes("calendar=disconnected") ||
    disconnectBody.includes("Google Calendar disconnected."))) {
    throw new Error("Calendar disconnect did not redirect with success status");
  }
  const { data: disconnectedProfile } = await guest.from("profiles")
    .select("calendar_connected, calendar_status").eq("id", testUserId).single();
  const { data: oldConnection } = await admin.from("calendar_connections")
    .select("user_id").eq("user_id", testUserId).maybeSingle();
  if (disconnectedProfile?.calendar_connected || disconnectedProfile?.calendar_status !== "skipped" || oldConnection) {
    throw new Error("Calendar credential or connection status remained after disconnect");
  }
  console.log("PASS: Calendar connected controls rendered; disconnect removed the test credential and status.");
} finally {
  if (testUserId) {
    const { error } = await admin.auth.admin.deleteUser(testUserId);
    if (error) console.error("Test account cleanup failed; remove the disposable anonymous account manually.");
  }
}
