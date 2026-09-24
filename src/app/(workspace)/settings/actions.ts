"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { recordCalendarOutcome } from "@/lib/calendar-connection";
import { CALENDAR_STATE_COOKIE } from "@/lib/google-calendar";
import { ensureAndLoadProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

export async function disconnectCalendar() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const profile = await ensureAndLoadProfile(supabase, user.id);
  if (!profile.onboarding_completed) redirect("/onboarding");

  if (profile.calendar_connected) {
    try {
      await recordCalendarOutcome(user.id, "skipped");
    } catch {
      redirect("/settings?calendar=disconnect-error");
    }
  }
  (await cookies()).set(CALENDAR_STATE_COOKIE, "", { path: "/onboarding", maxAge: 0 });
  redirect("/settings?calendar=disconnected");
}