import { createAdminClient } from "@/lib/supabase/admin";
import type { CalendarStatus } from "@/lib/onboarding-types";
import { readConnectedCalendarEmail } from "@/lib/google-calendar";

export async function recordCalendarOutcome(
  userId: string,
  status: Exclude<CalendarStatus, "pending">,
  encryptedRefreshToken?: string,
  scope?: string,
  accountEmail?: string,
) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_calendar_outcome", {
    p_user_id: userId,
    p_status: status,
    p_refresh_token_ciphertext: encryptedRefreshToken ?? null,
    p_scope: scope ?? null,
    p_account_email: accountEmail ?? null,
  });
  if (error) throw new Error("Unable to save Calendar connection");
}

export async function loadConnectedCalendarEmail(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("calendar_connections")
    .select("account_email, refresh_token_ciphertext, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.account_email) return data.account_email as string;

  try {
    const email = await readConnectedCalendarEmail(data.refresh_token_ciphertext);
    if (email) {
      await admin.from("calendar_connections")
        .update({ account_email: email })
        .eq("user_id", userId)
        .eq("updated_at", data.updated_at);
    }
    return email;
  } catch {
    return null;
  }
}
