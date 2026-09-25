import { createAdminClient } from "@/lib/supabase/admin";

export interface CreditCheckResult {
  hasEnough: boolean;
  balance: number;
  required: number;
  error?: string;
}

export interface CreditDeductionResult {
  success: boolean;
  deducted: number;
  balance: number;
  alreadyCharged: boolean;
  error?: string;
  transactionId?: string;
}

/**
 * Calculates required credits for media processing.
 *
 * Rules:
 * - 1 started minute = 1 credit
 * - credits_required = ceil(duration_seconds / 60)
 *
 * A duration of 0 or unmeasured audio/video defaults to 1 credit (1 started minute).
 */
export function calculateCreditsRequired(durationSeconds?: number | null): number {
  const dur = Math.max(0, Number(durationSeconds) || 0);
  return Math.max(1, Math.ceil(dur / 60));
}

/**
 * Generates a clear, user-facing error message when credits are insufficient.
 */
export function formatInsufficientCreditsMessage(
  required: number,
  balance: number,
  durationSeconds?: number
): string {
  const minutes = durationSeconds && durationSeconds > 0
    ? Math.ceil(durationSeconds / 60)
    : required;
  const minuteText = `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const reqText = `${required} credit${required === 1 ? "" : "s"}`;
  const balText = `${balance} credit${balance === 1 ? "" : "s"}`;

  return `Insufficient credits: Processing this ${minuteText} recording requires ${reqText}, but you only have ${balText} available. Please add credits to continue.`;
}

/**
 * Retrieves the current credits balance for a user.
 */
export async function getUserCreditsBalance(userId: string): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("credits_balance")
      .eq("id", userId)
      .maybeSingle();

    if (error || !profile) {
      console.warn(`Could not fetch credits balance for user ${userId}:`, error?.message);
      return 0;
    }

    return typeof profile.credits_balance === "number" ? profile.credits_balance : 0;
  } catch (err) {
    console.error(`Error reading credit balance for user ${userId}:`, err);
    return 0;
  }
}

/**
 * Checks whether a user has sufficient credits before processing starts.
 */
export async function checkUserCredits(
  userId: string,
  requiredCredits: number,
  durationSeconds?: number
): Promise<CreditCheckResult> {
  const balance = await getUserCreditsBalance(userId);
  const hasEnough = balance >= requiredCredits;

  return {
    hasEnough,
    balance,
    required: requiredCredits,
    error: hasEnough
      ? undefined
      : formatInsufficientCreditsMessage(requiredCredits, balance, durationSeconds),
  };
}

/**
 * Checks if a meeting has already had credits deducted.
 */
export async function hasMeetingBeenCharged(meetingId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("credit_transactions")
      .select("id")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (error) {
      // If table doesn't exist yet, return false
      return false;
    }

    return !!data;
  } catch {
    return false;
  }
}

/**
 * Deducts media-processing credits upon successful completion.
 *
 * Idempotency guarantees:
 * - Checks if meeting has already been charged (via unique credit_transactions record).
 * - Deducts credits only ONCE across retries, duplicate webhooks, or page refreshes.
 * - Failed processing must deduct 0 credits (callers should only invoke this upon success).
 */
export async function deductProcessingCredits({
  userId,
  meetingId,
  durationSeconds,
  recordingId,
}: {
  userId: string;
  meetingId: string;
  durationSeconds: number;
  recordingId?: string;
}): Promise<CreditDeductionResult> {
  const admin = createAdminClient();
  const creditsRequired = calculateCreditsRequired(durationSeconds);

  // 1. Try atomic PostgreSQL stored procedure if available
  try {
    const { data: rpcData, error: rpcError } = await admin.rpc(
      "deduct_media_processing_credits",
      {
        p_user_id: userId,
        p_meeting_id: meetingId,
        p_duration_seconds: Math.max(0, Math.round(durationSeconds || 0)),
      }
    );

    if (!rpcError && rpcData && typeof rpcData === "object") {
      const typed = rpcData as {
        success?: boolean;
        already_charged?: boolean;
        credits_deducted?: number;
        balance?: number;
        transaction_id?: string;
        error?: string;
      };

      if (typed.success) {
        return {
          success: true,
          deducted: typed.credits_deducted ?? (typed.already_charged ? 0 : creditsRequired),
          balance: typed.balance ?? 0,
          alreadyCharged: !!typed.already_charged,
          transactionId: typed.transaction_id,
        };
      }

      if (typed.error === "Insufficient credits") {
        return {
          success: false,
          deducted: 0,
          balance: typed.balance ?? 0,
          alreadyCharged: false,
          error: formatInsufficientCreditsMessage(creditsRequired, typed.balance ?? 0, durationSeconds),
        };
      }
    }
  } catch {
    // Stored procedure not yet available or failed, fall through to resilient direct query handler below
  }

  // 2. Direct client fallback handler with strict idempotency
  try {
    // Step A: Check if a transaction for this meeting already exists
    const { data: existingTx } = await admin
      .from("credit_transactions")
      .select("id, amount, credits_deducted")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (existingTx) {
      const currentBalance = await getUserCreditsBalance(userId);
      return {
        success: true,
        deducted: 0,
        balance: currentBalance,
        alreadyCharged: true,
        transactionId: existingTx.id,
      };
    }

    // Step B: Check user balance
    const currentBalance = await getUserCreditsBalance(userId);
    if (currentBalance < creditsRequired) {
      return {
        success: false,
        deducted: 0,
        balance: currentBalance,
        alreadyCharged: false,
        error: formatInsufficientCreditsMessage(creditsRequired, currentBalance, durationSeconds),
      };
    }

    // Step C: Deduct from profiles
    const newBalance = Math.max(0, currentBalance - creditsRequired);
    const { error: profileUpdateErr } = await admin
      .from("profiles")
      .update({ credits_balance: newBalance })
      .eq("id", userId);

    if (profileUpdateErr) {
      return {
        success: false,
        deducted: 0,
        balance: currentBalance,
        alreadyCharged: false,
        error: `Failed to update credit balance: ${profileUpdateErr.message}`,
      };
    }

    // Step D: Insert unique transaction record
    const { data: txRecord, error: txErr } = await admin
      .from("credit_transactions")
      .insert({
        user_id: userId,
        meeting_id: meetingId,
        recording_id: recordingId || null,
        amount: creditsRequired,
        credits_deducted: creditsRequired,
        duration_seconds: Math.max(0, Math.round(durationSeconds || 0)),
        type: "media_processing",
        status: "completed",
      })
      .select("id")
      .single();

    if (txErr) {
      // If unique constraint violation occurred (concurrent execution), refund the deducted balance
      if (txErr.code === "23505" || txErr.message?.includes("unique")) {
        await admin
          .from("profiles")
          .update({ credits_balance: currentBalance })
          .eq("id", userId);

        return {
          success: true,
          deducted: 0,
          balance: currentBalance,
          alreadyCharged: true,
        };
      }

      console.warn("Could not record credit transaction:", txErr.message);
    }

    return {
      success: true,
      deducted: creditsRequired,
      balance: newBalance,
      alreadyCharged: false,
      transactionId: txRecord?.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Credit deduction failed";
    console.error("Credit deduction unexpected error:", err);
    return {
      success: false,
      deducted: 0,
      balance: await getUserCreditsBalance(userId),
      alreadyCharged: false,
      error: message,
    };
  }
}
