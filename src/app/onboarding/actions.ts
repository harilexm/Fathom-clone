"use server";

import { redirect } from "next/navigation";
import { ensureAndLoadProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

export type FinishState = { error: string | null };

export async function finishOnboarding(_state: FinishState, _formData: FormData): Promise<FinishState> {
  // Setup choices are local; the form action only records completion.
  void _state;
  void _formData;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const profile = await ensureAndLoadProfile(supabase, user.id);
  if (profile.onboarding_completed) redirect("/my-calls");

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id)
    .select("id")
    .single();
  if (updateError || !updated) return { error: "Could not finish setup. Please try again." };
  redirect("/my-calls");
}
