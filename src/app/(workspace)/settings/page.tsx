import { Bell, CalendarDays, LockKeyhole, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { disconnectCalendar } from "./actions";
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

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const profile = await ensureAndLoadProfile(supabase, user.id);
  if (!profile.onboarding_completed) redirect("/onboarding");
  const accountEmail = profile.calendar_connected ? await loadConnectedCalendarEmail(user.id) : null;
  const { calendar } = await searchParams;
  const feedback = calendar === "denied"
    ? profile.calendar_connected ? "Calendar authorization was canceled. Your existing connection is unchanged." : "Calendar access was declined. Nothing was connected."
    : calendar && Object.prototype.hasOwnProperty.call(messages, calendar) ? messages[calendar] : null;

  return <section aria-label="Settings" className="fade-in max-w-3xl">
    {feedback && <p role="status" className="mb-4 rounded-lg border border-[#253345] bg-[#0d1420] px-4 py-3 text-xs text-[#b7cfff]">{feedback}</p>}
    <div className="surface divide-y divide-[#253345]">
      <div className="flex items-start gap-3 p-4"><UserRound size={17} className="mt-0.5 text-brand" /><div className="min-w-0"><p className="text-xs font-semibold text-ink">Profile</p><p className="mt-1 text-[11px] text-muted">Jamie Davis · Demo profile</p></div></div>
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
      <div className="flex items-start gap-3 p-4"><Bell size={17} className="mt-0.5 text-brand" /><div><p className="text-xs font-semibold text-ink">Notifications</p><p className="mt-1 text-[11px] text-muted">Preferences will be available when accounts are connected.</p></div></div>
      <div className="flex items-start gap-3 p-4"><LockKeyhole size={17} className="mt-0.5 text-brand" /><div><p className="text-xs font-semibold text-ink">Privacy and access</p><p className="mt-1 text-[11px] text-muted">Private meeting access will be enforced in a later step.</p></div></div>
    </div>
  </section>;
}