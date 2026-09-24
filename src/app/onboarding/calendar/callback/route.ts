import { NextRequest, NextResponse } from "next/server";
import { recordCalendarOutcome } from "@/lib/calendar-connection";
import { CALENDAR_STATE_COOKIE, exchangeCalendarCode, verifyCalendarOAuthAttempt, type CalendarReturnTo } from "@/lib/google-calendar";
import { getOnboardingContext } from "@/lib/onboarding-server";

export const dynamic = "force-dynamic";

function finish(request: NextRequest, outcome: string, returnTo: CalendarReturnTo) {
  const response = NextResponse.redirect(new URL(`/${returnTo}?calendar=${outcome}`, request.url));
  response.cookies.set(CALENDAR_STATE_COOKIE, "", { path: "/onboarding", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const context = await getOnboardingContext();
  if (!context) return NextResponse.redirect(new URL("/login", request.url));

  const fallback: CalendarReturnTo = context.profile.onboarding_completed ? "settings" : "onboarding";
  const state = request.nextUrl.searchParams.get("state");
  const cookie = request.cookies.get(CALENDAR_STATE_COOKIE)?.value;
  if (!state || !cookie) return finish(request, "invalid", fallback);

  let attempt: ReturnType<typeof verifyCalendarOAuthAttempt>;
  try {
    attempt = verifyCalendarOAuthAttempt(cookie, state, context.user.id);
  } catch {
    return finish(request, "invalid", fallback);
  }
  if (attempt.returnTo !== fallback) return finish(request, "invalid", fallback);

  if (request.nextUrl.searchParams.has("error")) {
    if (fallback === "settings" && context.profile.calendar_connected) return finish(request, "denied", fallback);
    try {
      await recordCalendarOutcome(context.user.id, "denied");
      return finish(request, "denied", fallback);
    } catch {
      return finish(request, "save-error", fallback);
    }
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return finish(request, "invalid", fallback);
  try {
    const { encryptedRefreshToken, scope, accountEmail } = await exchangeCalendarCode(code, attempt.verifier);
    await recordCalendarOutcome(context.user.id, "connected", encryptedRefreshToken, scope, accountEmail ?? undefined);
    return finish(request, "connected", fallback);
  } catch {
    return finish(request, "connect-error", fallback);
  }
}