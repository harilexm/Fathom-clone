"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureAndLoadProfile } from "@/lib/supabase/profile";

export type AuthState = { error: string | null; message: string | null };

function callbackUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is required for auth redirects");
  return new URL("/auth/callback", siteUrl).toString();
}

export async function authenticatePassword(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const mode = formData.get("mode");
  if (!email || !password || (mode !== "login" && mode !== "signup")) {
    return { error: "Enter your email and password.", message: null };
  }

  const supabase = await createClient();
  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) return { error: error.message || "Could not create your account.", message: null };
    if (!data.session) return { error: null, message: "Check your email to confirm your account, then sign in." };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Could not sign in. Check your email and password, then try again.", message: null };
  }
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Could not sign in. Please try again.", message: null };
  const profile = await ensureAndLoadProfile(supabase, user.id);
  redirect(profile.onboarding_completed ? "/my-calls" : "/onboarding");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(), queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function signInAsGuest() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) redirect("/login?error=guest");
  const profile = await ensureAndLoadProfile(supabase, data.user.id);
  redirect(profile.onboarding_completed ? "/my-calls" : "/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Could not sign out");
  redirect("/login");
}
