"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { recordCalendarOutcome } from "@/lib/calendar-connection";
import { CALENDAR_STATE_COOKIE } from "@/lib/google-calendar";
import { getOnboardingContext } from "@/lib/onboarding-server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SaveState = { error: string | null; savedStep: number | null; calendarStatus?: "skipped" };
export type FinishState = { error: string | null };

type ChoiceStep = "usage" | "meeting" | "sharing" | "job";
const choices: Record<ChoiceStep, { order: number; column: string; values: readonly string[] }> = {
  usage: { order: 2, column: "usage_type", values: ["individual", "team"] },
  meeting: { order: 3, column: "meeting_preference", values: ["manual", "automatic"] },
  sharing: { order: 4, column: "sharing_preference", values: ["private", "team"] },
  job: { order: 5, column: "job_function", values: ["", "engineering", "product", "sales", "customer-success", "operations", "other"] },
};

export async function saveOnboardingStep(_state: SaveState, formData: FormData): Promise<SaveState> {
  void _state;
  const context = await getOnboardingContext();
  if (!context) redirect("/login");
  if (context.profile.onboarding_completed) redirect("/my-calls");

  const step = formData.get("step");
  const value = formData.get("value");
  if (typeof step !== "string" || typeof value !== "string") return { error: "Choose an option to continue.", savedStep: null };

  if (step === "calendar") {
    if (value !== "skip") return { error: "Choose a Calendar option to continue.", savedStep: null };
    try {
      await recordCalendarOutcome(context.user.id, "skipped");
      (await cookies()).set(CALENDAR_STATE_COOKIE, "", { path: "/onboarding", maxAge: 0 });
      return { error: null, savedStep: 1, calendarStatus: "skipped" };
    } catch {
      return { error: "Could not save your Calendar choice. Please try again.", savedStep: null };
    }
  }

  if (!(step in choices)) return { error: "Unknown setup step.", savedStep: null };
  const choice = choices[step as ChoiceStep];
  if (context.profile.onboarding_step < choice.order - 1) return { error: "Complete the previous step first.", savedStep: null };
  if (!choice.values.includes(value)) return { error: "Choose a valid option to continue.", savedStep: null };

  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles")
    .update({ [choice.column]: value || null, onboarding_step: Math.max(context.profile.onboarding_step, choice.order) })
    .eq("id", context.user.id)
    .eq("onboarding_completed", false)
    .select("onboarding_step")
    .single();
  if (error || !data) return { error: "Could not save this step. Please try again.", savedStep: null };
  return { error: null, savedStep: choice.order };
}

export async function finishOnboarding(_state: FinishState, _formData: FormData): Promise<FinishState> {
  void _state;
  const jobFunction = _formData.get("job_function");
  const context = await getOnboardingContext();
  if (!context) redirect("/login");
  if (context.profile.onboarding_completed) redirect("/my-calls");
  const profile = context.profile;
  if (
    profile.onboarding_step < 4 ||
    profile.calendar_status === "pending" ||
    !profile.usage_type ||
    !profile.meeting_preference ||
    !profile.sharing_preference
  ) return { error: "Complete each setup step before finishing." };

  if (typeof jobFunction !== "string" || !choices.job.values.includes(jobFunction)) return { error: "Choose a valid job function." };
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles")
    .update({ onboarding_step: 5, onboarding_completed: true, job_function: jobFunction || null })
    .eq("id", context.user.id)
    .eq("onboarding_completed", false)
    .select("id")
    .single();
  if (error || !data) return { error: "Could not finish setup. Please try again." };
  redirect("/my-calls");
}
