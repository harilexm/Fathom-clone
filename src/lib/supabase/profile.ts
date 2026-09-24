import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/onboarding-types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function ensureAndLoadProfile(supabase: ServerClient, userId: string) {
  const { error: bootstrapError } = await supabase.rpc("ensure_profile");
  if (bootstrapError) throw new Error("Unable to initialize user profile");

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, onboarding_completed, calendar_connected, calendar_status, onboarding_step, usage_type, meeting_preference, sharing_preference, job_function, credits_balance")
    .eq("id", userId)
    .single();
  if (readError || !profile) throw new Error("Unable to load user profile");
  return profile as UserProfile;
}
