import { createAdminClient } from "@/lib/supabase/admin";
import type { CalendarStatus } from "@/lib/onboarding-types";

export async function recordCalendarOutcome(
  userId: string,
  status: Exclude<CalendarStatus, "pending">,
  encryptedRefreshToken?: string,
  scope?: string,
) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_calendar_outcome", {
    p_user_id: userId,
    p_status: status,
    p_refresh_token_ciphertext: encryptedRefreshToken ?? null,
    p_scope: scope ?? null,
  });
  if (error) throw new Error("Unable to save Calendar connection");
}
