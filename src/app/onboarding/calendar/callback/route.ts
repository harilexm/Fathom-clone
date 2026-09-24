import { NextRequest, NextResponse } from "next/server";
import { recordCalendarOutcome } from "@/lib/calendar-connection";
import { CALENDAR_STATE_COOKIE, exchangeCalendarCode, verifyCalendarOAuthAttempt } from "@/lib/google-calendar";
import { getOnboardingContext } from "@/lib/onboarding-server";

export const dynamic = "force-dynamic";

function finish(request: NextRequest, outcome: string) {
  const response = NextResponse.redirect(new URL(`/onboarding?calendar=${outcome}`, request.url));
  response.cookies.set(CALENDAR_STATE_COOKIE, "", { path: "/onboarding", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const context = await getOnboardingContext();
  if (!context) return NextResponse.redirect(new URL("/login", request.url));
  if (context.profile.onboarding_completed) return NextResponse.redirect(new URL("/my-calls", request.url));

  const state = request.nextUrl.searchParams.get("state");
  const cookie = request.cookies.get(CALENDAR_STATE_COOKIE)?.value;
  if (!state || !cookie) return finish(request, "invalid");

  let verifier: string;
  try {
    verifier = verifyCalendarOAuthAttempt(cookie, state, context.user.id);
  } catch {
    return finish(request, "invalid");
  }

  if (request.nextUrl.searchParams.has("error")) {
    try {
      await recordCalendarOutcome(context.user.id, "denied");
      return finish(request, "denied");
    } catch {
      return finish(request, "save-error");
    }
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return finish(request, "invalid");
  try {
    const { encryptedRefreshToken, scope } = await exchangeCalendarCode(code, verifier);
    await recordCalendarOutcome(context.user.id, "connected", encryptedRefreshToken, scope);
    return finish(request, "connected");
  } catch {
    return finish(request, "connect-error");
  }
}
