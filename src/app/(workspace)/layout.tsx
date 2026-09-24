import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) redirect("/login");
  const { error: profileError } = await supabase.rpc("ensure_profile");
  if (profileError) throw new Error("Unable to initialize user profile");
  return <AppShell>{children}</AppShell>;
}
