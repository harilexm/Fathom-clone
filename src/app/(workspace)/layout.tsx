import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ensureAndLoadProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const profile = await ensureAndLoadProfile(supabase, user.id);
  if (!profile.onboarding_completed) redirect("/onboarding");

  return <AppShell account={{
    email: user.email ?? null,
    isAnonymous: user.is_anonymous ?? false,
    plan: profile.plan,
    trialEndsAt: profile.trial_ends_at,
    credits: profile.credits_balance,
  }}>{children}</AppShell>;
}
