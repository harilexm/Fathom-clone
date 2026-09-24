import { ensureAndLoadProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

export async function getOnboardingContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const profile = await ensureAndLoadProfile(supabase, user.id);
  return { user, profile };
}
