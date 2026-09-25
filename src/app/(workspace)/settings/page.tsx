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
        className="h-9 min-w-[220px] rounded-lg border border-[#2b3b4e] bg-[#0c1421] px-3 text-xs font-medium text-[#e0eaf6] outline-none focus:border-[#4b83ff] focus:ring-1 focus:ring-[#4b83ff]/40 cursor-pointer"
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value} disabled={choice.disabled} className="bg-[#0c1421] text-[#e0eaf6]">
            {choice.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-9 rounded-lg border border-[#2b3b4e] bg-[#141f2e] px-4 text-xs font-semibold text-[#c0cce0] transition hover:border-[#4b83ff] hover:bg-[#1a293d] hover:text-white"
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
        <div className="border-b border-[#1e2a3a] pb-6">
          <Link
            href="/my-calls"
            className="mb-3 inline-flex items-center text-xs font-semibold text-[#8da3be] hover:text-white transition"
          >
            ← Back to Calls
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Settings</h1>
          <p className="mt-1.5 text-xs text-[#8da3be]">
            Manage your account credentials, calendar integration, AI preferences, and recording defaults.
          </p>
        </div>

        {/* Notifications / Alerts */}
        {feedback && (
          <div
            role="status"
            className="rounded-xl border border-blue-500/30 bg-[#0d1a29] p-4 text-xs font-medium text-[#b7cfff] shadow-sm"
          >
            {feedback}
          </div>
        )}
        {preference && preferenceMessages[preference] && (
          <div
            role={preference === "saved" ? "status" : "alert"}
            className={`rounded-xl p-4 text-xs font-medium shadow-sm border ${
              preference === "saved"
                ? "border-emerald-500/30 bg-[#0c1f19] text-emerald-300"
                : "border-rose-500/30 bg-[#230f14] text-rose-300"
            }`}
          >
            {preferenceMessages[preference]}
          </div>
        )}

        {/* Section 1: Account Profile */}
        <div className="surface rounded-2xl border border-[#223348] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-white">Profile &amp; Account</h2>
          <p className="mt-1 text-xs text-[#8da3be]">
            Your active identity and sign-in email in this workspace.
          </p>

          <div className="mt-4 rounded-xl border border-[#1e2d3f] bg-[#0c131e] p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6a8099]">Email Address</span>
                <p className="mt-0.5 text-sm font-semibold text-white break-all">
                  {user.is_anonymous ? "Demo guest (Anonymous)" : user.email ?? "Email unavailable"}
                </p>
              </div>
              <span className="self-start sm:self-auto rounded-full bg-[#1b2b3f] px-3 py-1 text-[11px] font-semibold text-[#8bb9f0]">
                {user.is_anonymous ? "Guest Account" : "Registered User"}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Calendar Integration */}
        <div className="surface rounded-2xl border border-[#223348] p-6 shadow-sm">
          <h2 className="text-sm font-bold text-white">Google Calendar Integration</h2>
          <p className="mt-1 text-xs text-[#8da3be]">
            Connect your calendar to view upcoming meetings and automatically synchronize call context.
          </p>

          <div className="mt-4 rounded-xl border border-[#1e2d3f] bg-[#0c131e] p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6a8099]">Connection Status</span>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      profile.calendar_connected ? "bg-emerald-400" : "bg-[#54687e]"
                    }`}
                  />
                  <span className="text-xs font-semibold text-white">
                    {profile.calendar_connected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#8da3be]">
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
                        className="rounded-lg border border-[#2e3e52] bg-[#121c29] px-3.5 py-2 text-xs font-semibold text-[#d0dbe8] transition hover:border-rose-500/50 hover:bg-rose-950/30 hover:text-rose-300"
                      >
                        Disconnect
                      </button>
                    </form>
                    <a
                      href="/onboarding/calendar/start?returnTo=settings"
                      className="rounded-lg border border-[#2e3e52] bg-[#121c29] px-3.5 py-2 text-xs font-semibold text-[#d0dbe8] transition hover:border-[#4b83ff] hover:bg-[#18283d] hover:text-white"
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
        <div className="surface rounded-2xl border border-[#223348] p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white">AI &amp; Meeting Analysis</h2>
            <p className="mt-1 text-xs text-[#8da3be]">
              Configure default styles for AI-generated summaries and automatic moment detection.
            </p>
          </div>

          <div className="space-y-5 divide-y divide-[#1e2d3f] pt-1">
            <div className="pt-4 first:pt-0">
              <h3 className="text-xs font-bold text-white">Default Summary Template</h3>
              <p className="mt-1 text-xs text-[#8da3be]">
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
              <h3 className="text-xs font-bold text-white">Auto Highlight Generation</h3>
              <p className="mt-1 text-xs text-[#8da3be]">
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
        <div className="surface rounded-2xl border border-[#223348] p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white">Recording &amp; Sharing Defaults</h2>
            <p className="mt-1 text-xs text-[#8da3be]">
              Configure access privacy and default capture modes for your meeting recordings.
            </p>
          </div>

          <div className="space-y-5 divide-y divide-[#1e2d3f] pt-1">
            <div className="pt-4 first:pt-0">
              <h3 className="text-xs font-bold text-white">Default Sharing Privacy</h3>
              <p className="mt-1 text-xs text-[#8da3be]">
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
              <h3 className="text-xs font-bold text-white">Meeting Capture Mode</h3>
              <p className="mt-1 text-xs text-[#8da3be]">
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
        <div className="rounded-2xl border border-[#202d3d] bg-[#0c131e] p-6 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#8da3be]">Data Management &amp; Retention</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#758a9e]">
            Your recordings and transcripts are securely stored in private storage. Self-service account deletion and data exports are handled through administrator requests for this test workspace.
          </p>
        </div>
      </section>
    </div>
  );
}
