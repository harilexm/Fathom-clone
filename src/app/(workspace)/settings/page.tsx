import { CalendarDays, UserRound, FileText, Share2, Video, Bookmark, Trash2 } from "lucide-react";
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
  saved: "Preference saved.",
  invalid: "That preference is unavailable.",
  error: "Could not save your preference. Please try again.",
};

function PreferenceForm({ name, setting, value, choices }: {
  name: string;
  setting: string;
  value: string;
  choices: { value: string; label: string; disabled?: boolean }[];
}) {
  return <form action={savePreference} className="mt-3 flex flex-wrap items-center gap-2">
    <input type="hidden" name="key" value={setting} />
    <label className="sr-only" htmlFor={setting}>{name}</label>
    <select id={setting} name="value" defaultValue={value} className="h-9 min-w-[220px] rounded-md border border-[#33445c] bg-[#0d1420] px-3 text-xs text-ink focus:border-brand">
      {choices.map((choice) => <option key={choice.value} value={choice.value} disabled={choice.disabled}>{choice.label}</option>)}
    </select>
    <button type="submit" className="rounded-md border border-[#33445c] px-3 py-2 text-[11px] font-semibold text-[#c0cce0] hover:border-[#4b83ff] hover:text-white">Save</button>
  </form>;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ calendar?: string; preference?: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const profile = await ensureAndLoadProfile(supabase, user.id);
  if (!profile.onboarding_completed) redirect("/onboarding");
  const accountEmail = profile.calendar_connected ? await loadConnectedCalendarEmail(user.id) : null;
  const { calendar, preference } = await searchParams;
  const feedback = calendar === "denied"
    ? profile.calendar_connected ? "Calendar authorization was canceled. Your existing connection is unchanged." : "Calendar access was declined. Nothing was connected."
    : calendar && Object.prototype.hasOwnProperty.call(messages, calendar) ? messages[calendar] : null;

  return <section aria-label="Settings" className="fade-in max-w-3xl">
    <div className="mb-4"><p className="text-xs text-muted">Workspace</p><h1 className="mt-1 text-xl font-semibold text-ink">Settings</h1></div>
    {feedback && <p role="status" className="mb-4 rounded-lg border border-[#253345] bg-[#0d1420] px-4 py-3 text-xs text-[#b7cfff]">{feedback}</p>}
    {preference && preferenceMessages[preference] && <p role={preference === "saved" ? "status" : "alert"} className="mb-4 rounded-lg border border-[#253345] bg-[#0d1420] px-4 py-3 text-xs text-[#b7cfff]">{preferenceMessages[preference]}</p>}
    <div className="surface divide-y divide-[#253345]">
      <div className="flex items-start gap-3 p-4"><UserRound size={17} className="mt-0.5 text-brand" /><div className="min-w-0"><p className="text-xs font-semibold text-ink">Profile</p><p className="mt-1 break-all text-[11px] text-muted">{user.is_anonymous ? "Demo guest" : user.email ?? "Email unavailable"}</p></div></div>
      <div className="flex flex-wrap items-start gap-3 p-4">
        <CalendarDays size={17} className="mt-0.5 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink">Google Calendar</p>
          <p className="mt-1 break-all text-[11px] text-muted">{profile.calendar_connected ? accountEmail ?? "Google account connected" : "Not connected"}</p>
          <p className="mt-2 text-[11px] font-semibold text-ink">Status: {profile.calendar_connected ? "Connected" : "Not connected"}</p>
        </div>
        {profile.calendar_connected ? <div className="flex items-center gap-2">
          <form action={disconnectCalendar}><button type="submit" className="rounded-md border border-[#33445c] px-3 py-1.5 text-[11px] font-semibold text-[#c0cce0] hover:border-[#4b83ff] hover:text-white">Disconnect</button></form>
          <a href="/onboarding/calendar/start?returnTo=settings" className="rounded-md border border-[#33445c] px-3 py-1.5 text-[11px] font-semibold text-[#c0cce0] hover:border-[#4b83ff] hover:text-white">Reconnect</a>
        </div> : <a href="/onboarding/calendar/start?returnTo=settings" className="rounded-md border border-[#33445c] px-3 py-1.5 text-[11px] font-semibold text-[#c0cce0] hover:border-[#4b83ff] hover:text-white">Connect Calendar</a>}
      </div>
      <div className="flex items-start gap-3 p-4"><FileText size={17} className="mt-0.5 text-brand" /><div className="min-w-0 flex-1"><h2 className="text-xs font-semibold text-ink">Default summary template</h2><p className="mt-1 text-[11px] text-muted">Applies to future AI analyses. Existing summaries stay as they are.</p><PreferenceForm name="Default summary template" setting="summary_template" value={user.user_metadata?.summary_template === "concise" ? "concise" : "standard"} choices={[{ value: "standard", label: "Standard overview" }, { value: "concise", label: "Concise overview" }]} /></div></div>
      <div className="flex items-start gap-3 p-4"><Share2 size={17} className="mt-0.5 text-brand" /><div className="min-w-0 flex-1"><h2 className="text-xs font-semibold text-ink">Default sharing preference</h2><p className="mt-1 text-[11px] text-muted">Meetings remain private until you explicitly create a share link. Team-wide sharing is not available.</p><PreferenceForm name="Default sharing preference" setting="sharing_preference" value={profile.sharing_preference ?? "private"} choices={[{ value: "private", label: "Private" }, { value: "team", label: "Team sharing (unavailable)", disabled: true }]} /></div></div>
      <div className="flex items-start gap-3 p-4"><Video size={17} className="mt-0.5 text-brand" /><div className="min-w-0 flex-1"><h2 className="text-xs font-semibold text-ink">Meeting and recording preferences</h2><p className="mt-1 text-[11px] text-muted">Recordings are added manually through My Calls. Automatic capture is not available.</p><PreferenceForm name="Meeting capture preference" setting="meeting_preference" value={profile.meeting_preference ?? "manual"} choices={[{ value: "manual", label: "Manual upload" }, { value: "automatic", label: "Automatic capture (unavailable)", disabled: true }]} /></div></div>
      <div className="flex items-start gap-3 p-4"><Bookmark size={17} className="mt-0.5 text-brand" /><div className="min-w-0 flex-1"><h2 className="text-xs font-semibold text-ink">Highlight preference</h2><p className="mt-1 text-[11px] text-muted">Controls AI-suggested highlights in future analyses. You can still create your own highlights.</p><PreferenceForm name="Highlight preference" setting="highlight_preference" value={user.user_metadata?.highlight_preference === "none" ? "none" : "suggest"} choices={[{ value: "suggest", label: "Suggest highlights" }, { value: "none", label: "Do not suggest highlights" }]} /></div></div>
      <div className="flex items-start gap-3 p-4"><Trash2 size={17} className="mt-0.5 text-brand" /><div><h2 className="text-xs font-semibold text-ink">Account deletion</h2><p className="mt-1 text-[11px] text-muted">Self-service account and recording deletion is not implemented in this test project.</p></div></div>
    </div>
  </section>;
}
