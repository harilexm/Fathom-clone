import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function ensureAndLoadProfile(supabase: ServerClient, userId: string) {
  const { error: bootstrapError } = await supabase.rpc("ensure_profile");
  if (bootstrapError) throw new Error("Unable to initialize user profile");

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, onboarding_completed")
    .eq("id", userId)
    .single();
  if (readError || !profile) throw new Error("Unable to load user profile");
  return profile;
}
