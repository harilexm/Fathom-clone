import Link from "next/link";
import { redirect } from "next/navigation";
import { disconnectCalendar, savePreference } from "./actions";
import { loadConnectedCalendarEmail } from "@/lib/calendar-connection";
import { ensureAndLoadProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  connected: "Google Calendar connected successfully.",
  disconnected: "Google Calendar disconnected.",
  unavailable: "Google Calendar connection is not configured yet.",
  invalid: "Calendar authorization expired or was invalid. Please try again.",
  "connect-error": "Could not connect Google Calendar. Please try again.",
  "save-error": "Could not save the Calendar connection. Please try again.",
  "disconnect-error": "Could not disconnect Google Calendar. Please try again.",
};

const preferenceMessages: Record<string, string> = {
  saved: "Preference saved successfully.",
  invalid: "That preference is unavailable.",
  error: "Could not save your preference. Please try again.",
};

function PreferenceForm({
  name,
  setting,
  value,
  choices,
}: {
  name: string;
  setting: string;
  value: string;
  choices: { value: string; label: string; disabled?: boolean }[];
}) {
  return (
    <form action={savePreference} className="mt-3 flex flex-wrap items-center gap-2.5">
      <input type="hidden" name="key" value={setting} />
      <label className="sr-only" htmlFor={setting}>
        {name}
      </label>
      <select
        id={setting}
        name="value"
        defaultValue={value}
        className="h-9 min-w-[220px] rounded-lg border border-[#151e2b] bg-[#080c14] px-3 text-xs font-medium text-[#f1f5f9] outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 cursor-pointer"
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value} disabled={choice.disabled} className="bg-[#080c14] text-[#f1f5f9]">
            {choice.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-9 rounded-lg border border-[#151e2b] bg-[#080c14] px-4 text-xs font-semibold text-[#cbd5e1] transition hover:border-[#1e2a3c] hover:bg-[#0d131d] hover:text-[#f1f5f9]"
      >
        Save
      </button>
    </form>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar?: string; preference?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const profile = await ensureAndLoadProfile(supabase, user.id);
  if (!profile.onboarding_completed) redirect("/onboarding");
  const accountEmail = profile.calendar_connected ? await loadConnectedCalendarEmail(user.id) : null;
  const { calendar, preference } = await searchParams;
  const feedback =
    calendar === "denied"
      ? profile.calendar_connected
        ? "Calendar authorization was canceled. Your existing connection is unchanged."
        : "Calendar access was declined. Nothing was connected."
      : calendar && Object.prototype.hasOwnProperty.call(messages, calendar)
      ? messages[calendar]
      : null;

  return (
    <div className="min-h-full py-8 px-4 sm:px-6">
      <section aria-label="Settings" className="fade-in mx-auto max-w-3xl space-y-6">
        {/* Top Breadcrumb & Page Header */}
        <div className="border-b border-[#131b26] pb-6">
          <Link
            href="/my-calls"
            className="mb-3 inline-flex items-center text-xs font-semibold text-muted hover:text-[#f1f5f9] transition"
          >
            ← Back to Calls
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f1f5f9] sm:text-3xl">Settings</h1>
          <p className="mt-1.5 text-xs text-muted">
            Manage your account credentials, calendar integration, AI preferences, and recording defaults.
          </p>
        </div>

        {/* Notifications / Alerts */}
        {feedback && (
          <div
            role="status"
            className="rounded-lg border border-[#1d3557] bg-[#0c182b] p-4 text-xs font-medium text-[#93c5fd] shadow-sm"
          >
            {feedback}
          </div>
        )}
        {preference && preferenceMessages[preference] && (
          <div
            role={preference === "saved" ? "status" : "alert"}
            className={`rounded-lg p-4 text-xs font-medium shadow-sm border ${
              preference === "saved"
                ? "border-[#0c3629] bg-[#061a14] text-[#34d399]"
                : "border-[#3b1219] bg-[#1a0a0e] text-[#f87171]"
            }`}
          >
            {preferenceMessages[preference]}
          </div>
        )}

        {/* Section 1: Account Profile */}
        <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#f1f5f9]">Profile &amp; Account</h2>
          <p className="mt-1 text-xs text-muted">
            Your active identity and sign-in email in this workspace.
          </p>

          <div className="mt-4 rounded-lg border border-[#151e2b] bg-[#080c14] p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Email Address</span>
                <p className="mt-0.5 text-sm font-semibold text-[#f1f5f9] break-all">
                  {user.is_anonymous ? "Demo guest (Anonymous)" : user.email ?? "Email unavailable"}
                </p>
              </div>
              <span className="self-start sm:self-auto rounded-full bg-[#0c182b] border border-[#1d3557] px-3 py-1 text-[11px] font-semibold text-[#60a5fa]">
                {user.is_anonymous ? "Guest Account" : "Registered User"}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Calendar Integration */}
        <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#f1f5f9]">Google Calendar Integration</h2>
          <p className="mt-1 text-xs text-muted">
            Connect your calendar to view upcoming meetings and automatically synchronize call context.
          </p>

          <div className="mt-4 rounded-lg border border-[#151e2b] bg-[#080c14] p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Connection Status</span>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      profile.calendar_connected ? "bg-emerald-400" : "bg-[#54687e]"
                    }`}
                  />
                  <span className="text-xs font-semibold text-[#f1f5f9]">
                    {profile.calendar_connected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {profile.calendar_connected
                    ? accountEmail ?? "Google account connected with read-only calendar scope"
                    : "No calendar is currently linked to your workspace"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {profile.calendar_connected ? (
                  <>
                    <form action={disconnectCalendar}>
                      <button
                        type="submit"
                        className="rounded-lg border border-[#151e2b] bg-[#080c14] px-3.5 py-2 text-xs font-semibold text-[#cbd5e1] transition hover:border-[#3b1219] hover:bg-[#1a0a0e] hover:text-[#f87171]"
                      >
                        Disconnect
                      </button>
                    </form>
                    <a
                      href="/onboarding/calendar/start?returnTo=settings"
                      className="rounded-lg border border-[#151e2b] bg-[#080c14] px-3.5 py-2 text-xs font-semibold text-[#cbd5e1] transition hover:border-[#1e2a3c] hover:bg-[#0d131d] hover:text-[#f1f5f9]"
                    >
                      Reconnect
                    </a>
                  </>
                ) : (
                  <a
                    href="/onboarding/calendar/start?returnTo=settings"
                    className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand/90"
                  >
                    Connect Calendar
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: AI & Analysis Preferences */}
        <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[#f1f5f9]">AI &amp; Meeting Analysis</h2>
            <p className="mt-1 text-xs text-muted">
              Configure default styles for AI-generated summaries and automatic moment detection.
            </p>
          </div>

          <div className="space-y-5 divide-y divide-[#131b26] pt-1">
            <div className="pt-4 first:pt-0">
              <h3 className="text-xs font-bold text-[#f1f5f9]">Default Summary Template</h3>
              <p className="mt-1 text-xs text-muted">
                Applies to future AI analyses. Existing summaries in your meeting library will stay unchanged.
              </p>
              <PreferenceForm
                name="Default summary template"
                setting="summary_template"
                value={user.user_metadata?.summary_template === "concise" ? "concise" : "standard"}
                choices={[
                  { value: "standard", label: "Standard overview" },
                  { value: "concise", label: "Concise overview" },
                ]}
              />
            </div>

            <div className="pt-4">
              <h3 className="text-xs font-bold text-[#f1f5f9]">Auto Highlight Generation</h3>
              <p className="mt-1 text-xs text-muted">
                Controls whether automatic highlights are extracted during AI analysis. You can always create custom highlights manually.
              </p>
              <PreferenceForm
                name="Highlight preference"
                setting="highlight_preference"
                value={user.user_metadata?.highlight_preference === "none" ? "none" : "suggest"}
                choices={[
                  { value: "suggest", label: "Suggest highlights automatically" },
                  { value: "none", label: "Do not suggest highlights" },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Recording & Sharing Defaults */}
        <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[#f1f5f9]">Recording &amp; Sharing Defaults</h2>
            <p className="mt-1 text-xs text-muted">
              Configure access privacy and default capture modes for your meeting recordings.
            </p>
          </div>

          <div className="space-y-5 divide-y divide-[#131b26] pt-1">
            <div className="pt-4 first:pt-0">
              <h3 className="text-xs font-bold text-[#f1f5f9]">Default Sharing Privacy</h3>
              <p className="mt-1 text-xs text-muted">
                Meetings remain private to your workspace until you explicitly generate a public share link.
              </p>
              <PreferenceForm
                name="Default sharing preference"
                setting="sharing_preference"
                value={profile.sharing_preference ?? "private"}
                choices={[
                  { value: "private", label: "Private (Only accessible by you)" },
                  { value: "team", label: "Team sharing (Unavailable in preview)", disabled: true },
                ]}
              />
            </div>

            <div className="pt-4">
              <h3 className="text-xs font-bold text-[#f1f5f9]">Meeting Capture Mode</h3>
              <p className="mt-1 text-xs text-muted">
                Recordings are added manually through the upload interface in My Calls.
              </p>
              <PreferenceForm
                name="Meeting capture preference"
                setting="meeting_preference"
                value={profile.meeting_preference ?? "manual"}
                choices={[
                  { value: "manual", label: "Manual file upload" },
                  { value: "automatic", label: "Automatic capture (Unavailable in preview)", disabled: true },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Section 5: Data & Retention Notice */}
        <div className="rounded-xl border border-[#131b26] bg-[#070a10] p-6 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Data Management &amp; Retention</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#758a9e]">
            Your recordings and transcripts are securely stored in private storage. Self-service account deletion and data exports are handled through administrator requests for this test workspace.
          </p>
        </div>
      </section>
    </div>
  );
}
