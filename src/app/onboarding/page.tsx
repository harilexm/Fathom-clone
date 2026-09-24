import { redirect } from "next/navigation";
import { OnboardingFlow } from "./onboarding-flow";
import { ensureAndLoadProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { calendarOAuthConfigured } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const profile = await ensureAndLoadProfile(supabase, user.id);
  if (profile.onboarding_completed) redirect("/my-calls");
  const { calendar } = await searchParams;
  return <OnboardingFlow profile={profile} calendarConfigured={calendarOAuthConfigured()} calendarFeedback={calendar} />;
}
