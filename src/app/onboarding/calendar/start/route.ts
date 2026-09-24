import { NextRequest, NextResponse } from "next/server";
import { calendarOAuthConfigured, CALENDAR_STATE_COOKIE, createCalendarOAuthAttempt } from "@/lib/google-calendar";
import { getOnboardingContext } from "@/lib/onboarding-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = await getOnboardingContext();
  if (!context) return NextResponse.redirect(new URL("/login", request.url));
  if (context.profile.onboarding_completed) return NextResponse.redirect(new URL("/my-calls", request.url));
  if (!calendarOAuthConfigured()) return NextResponse.redirect(new URL("/onboarding?calendar=unavailable", request.url));

  const { url, cookieValue } = createCalendarOAuthAttempt(context.user.id);
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
