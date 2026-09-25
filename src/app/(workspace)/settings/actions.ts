"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { recordCalendarOutcome } from "@/lib/calendar-connection";
import { CALENDAR_STATE_COOKIE } from "@/lib/google-calendar";
import { ensureAndLoadProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const choices = {
  summary_template: ["standard", "concise"],
  highlight_preference: ["suggest", "none"],
  meeting_preference: ["manual"],
  sharing_preference: ["private"],
} as const;

export async function savePreference(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const profile = await ensureAndLoadProfile(supabase, user.id);
  if (!profile.onboarding_completed) redirect("/onboarding");

  const key = formData.get("key");
  const value = formData.get("value");
  if (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(choices, key) || typeof value !== "string" ||
    !(choices[key as keyof typeof choices] as readonly string[]).includes(value)) {
    redirect("/settings?preference=invalid");
  }

  const admin = createAdminClient();
  if (key === "meeting_preference" || key === "sharing_preference") {
    const { error: saveError } = await admin.from("profiles")
      .update({ [key]: value }).eq("id", user.id);
    if (saveError) redirect("/settings?preference=error");
  } else {
    const { error: saveError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, [key]: value },
    });
    if (saveError) redirect("/settings?preference=error");
  }
  redirect("/settings?preference=saved");
}

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
