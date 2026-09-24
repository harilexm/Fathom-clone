import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { error: profileError } = await supabase.rpc("ensure_profile");
  if (profileError) throw new Error("Unable to initialize user profile");

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at")
    .eq("id", user.id)
    .single();
  if (readError || !profile) throw new Error("Unable to load user profile");

  return <AppShell account={{
    email: user.email ?? null,
    isAnonymous: user.is_anonymous ?? false,
    plan: profile.plan,
    trialEndsAt: profile.trial_ends_at,
  }}>{children}</AppShell>;
}
