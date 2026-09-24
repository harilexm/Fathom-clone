import { NextRequest, NextResponse } from "next/server";
import { calendarOAuthConfigured, CALENDAR_STATE_COOKIE, createCalendarOAuthAttempt, type CalendarReturnTo } from "@/lib/google-calendar";
import { getOnboardingContext } from "@/lib/onboarding-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = await getOnboardingContext();
  if (!context) return NextResponse.redirect(new URL("/login", request.url));

  const returnTo: CalendarReturnTo = request.nextUrl.searchParams.get("returnTo") === "settings" ? "settings" : "onboarding";
  if (returnTo === "settings" && !context.profile.onboarding_completed) return NextResponse.redirect(new URL("/onboarding", request.url));
  if (returnTo === "onboarding" && context.profile.onboarding_completed) return NextResponse.redirect(new URL("/my-calls", request.url));
  if (!calendarOAuthConfigured()) return NextResponse.redirect(new URL(`/${returnTo}?calendar=unavailable`, request.url));

  const { url, cookieValue } = createCalendarOAuthAttempt(context.user.id, returnTo);
  const response = NextResponse.redirect(url);
  response.cookies.set(CALENDAR_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/onboarding",
    maxAge: 600,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}